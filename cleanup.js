import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('必须设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE 环境变量（使用 GitHub Secrets）。');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function cleanupExpiredBatch(batchSize = 500) {
  const now = new Date().toISOString();
  let from = 0;
  let total = 0;
  while (true) {
    const { data, error } = await supabase
      .from('media_meta')
      .select('id, storage_path')
      .lte('expires_at', now)
      .order('created_at', { ascending: true })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('查询过期记录失败', error);
      throw error;
    }
    if (!data || data.length === 0) break;
    // collect paths
    const paths = data.map(r => r.storage_path).filter(Boolean);
    if (paths.length > 0) {
      try {
        const { error: delErr } = await supabase.storage.from('public-media').remove(paths);
        if (delErr) console.error('删除 storage 发生错误', delErr);
      } catch (e) {
        console.error('删除 storage 异常', e);
      }
    }
    // delete meta rows individually (safe)
    for (const r of data) {
      const { error: metaErr } = await supabase.from('media_meta').delete().eq('id', r.id);
      if (metaErr) console.error('删除 meta 失败', metaErr);
    }
    total += data.length;
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return total;
}

(async () => {
  try {
    console.log('开始清理 Supabase 中已过期文件...');
    const n = await cleanupExpiredBatch();
    console.log('清理完成，已删除', n, '个文件（若有）。');
  } catch (e) {
    console.error('清理任务异常', e);
    process.exit(1);
  }
})();