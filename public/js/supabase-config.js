// Supabase Configuration for hama.flow
// لێرە یان لەناو پانێڵی ئەدمین دەتوانیت زانیارییەکانی Supabase دابنێیت

window.SUPABASE_CONFIG = {
  // پڕۆژەکەت لە Supabase دروست بکە و ئەم دوو بەهایە لێرە دابنێ:
  url: localStorage.getItem('flow_supabase_url') || '',
  anonKey: localStorage.getItem('flow_supabase_key') || ''
};
