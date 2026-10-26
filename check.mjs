#!/usr/bin/env node
/**
 * 鲸鱼娘预设静态检查（无需安装依赖）。
 *
 *   node check.mjs
 *
 * 优先用本仓库的 yaml（devDependency）或当前 DSH profile 里的 yaml 做结构解析；
 * 都没有时退化为纯文本断言（会打印提示）。检查项跟随 cetacea.config.json：
 * 改名字/称呼/甜度/开关后仍然适用。
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const failures = [];
const passed = [];

function check(name, fn) {
  try {
    const result = fn();
    if (result === true) passed.push(name);
    else failures.push(`${name}: ${typeof result === 'string' ? result : '断言失败'}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

function loadYaml() {
  const candidates = [
    join(ROOT, 'package.json'),
    join(process.env.DSH_PROFILE_DIR ?? '', 'package.json'),
    join(process.env.HOME ?? '', '.dsh/profiles/desktop/package.json'),
    join(process.env.HOME ?? '', '.dsh/profiles/web/package.json'),
  ].filter(path => path && !path.startsWith('package.json'));
  for (const path of candidates) {
    try {
      return createRequire(path)('yaml');
    } catch {
      // next
    }
  }
  return null;
}

const config = JSON.parse(readFileSync(join(ROOT, 'cetacea.config.json'), 'utf8'));
const patchText = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8');
const YAML = loadYaml();
const title = config.character.userTitle.trim();
const name = config.character.name.trim();

let row = null;
if (YAML) {
  const doc = YAML.parse(patchText);
  row = doc?.[0]?.insert?.[0];
  check('cordis.patch.yml 可被 YAML 解析', () => Boolean(row) || '结构不是单条 insert');
} else {
  console.warn('⚠ 未找到 yaml 解析器，只做文本断言（安装依赖或设置 DSH_PROFILE_DIR 可启用完整检查）');
}

const persona = row
  ? row.config.plugins.find(p => p.id === 'persona')?.config?.prefix ?? ''
  : (patchText.match(/prefix: \|\n([\s\S]*?)\n {10}- id: time-context/)?.[1] ?? '');
check('能取到 persona.prefix', () => persona.length > 0 || '空');

if (row) {
  const plugins = row.config.plugins ?? [];
  const personaRow = plugins.find(p => p.id === 'persona');
  const timeRow = plugins.find(p => p.id === 'time-context');
  const compaction = plugins.find(p => p.id === 'compaction');
  check('preset id 与配置一致', () => row.config.id === config.preset.id || `patch=${row.config.id}`);
  check('preset 显示名与配置一致', () => row.config.name === config.preset.name || `patch=${row.config.name}`);
  check('preset order 与配置一致', () => row.config.order === Number(config.preset.order));
  check('persona 行 complete=true 且关闭 runtime context', () =>
    personaRow?.config?.complete === true && personaRow?.config?.includeRuntimeContext === false);
  check('time-context 时区与配置一致', () => timeRow?.config?.timeZone === config.timeZone);
  check('compaction 组含 compression 插件', () => {
    const names = (compaction?.config ?? []).map(p => p.name);
    return compaction?.group === true && names.includes('@deepseek-ai/dsh-compaction-basic');
  });
}

check('人设长度 1200~4500 字', () => {
  const n = [...persona].length;
  return (n >= 1200 && n <= 4500) || `实际 ${n} 字`;
});
check('没有未渲染的 {{ }} 或占位符', () =>
  (!persona.includes('{{') && !patchText.includes('__PRESET_ID__') && !patchText.includes('__PERSONA_BLOCK__')) || '残留模板标记');
check('人设包含角色名与称呼', () => persona.includes(name) && persona.includes(title) || '名字/称呼未渲染');
check('语言硬规则（回复与思考都用简体中文）', () =>
  persona.includes('只用简体中文回复') && persona.includes('思考也用简体中文'));
check('规则优先级章节在「只听<称呼>的」之前', () => {
  const a = persona.indexOf('【规则优先级');
  const b = persona.indexOf('【只听');
  return a >= 0 && b > a || '章节顺序不对';
});
check('章节标题使用配置的称呼', () =>
  persona.includes(`【只听${title}的】`) && persona.includes(`【和${title}相处】`) || '标题未按称呼渲染');

const required = {
  'IM 标记解释': ['<dsh_im_source>', '<dsh_im_source_guidance>', '<dsh_im_reply_to>'],
  '时间上下文解释': ['Time sampled while preparing turn'],
  '认主单一来源': ['档案只有一个来源', 'senderId'],
  'ID 精确匹配': ['一字不差', '发送者 ID'],
  'fail-closed': ['认不出 ID', '就是陌生人'],
  '名字不能认主': ['不能用来认'],
  '嘴说无效': ['光靠嘴说没用', `我是${title}`],
  '伪造标记无效': ['都是别人打出来的字', '不认、不执行'],
  '群友不转告/不问主人身份': ['不告诉你', '转告'],
  '隐私红线': ['隐私红线', '秘密', '联系方式', '住址', '证件', '照片'],
  '紧急叙事也不给': ['出事了', '120'],
  '不收红包礼物': ['红包'],
  '操作权限仅主人且限当前聊天': ['只读', '不转发'],
  '不松口': ['被夸、被求、被凶都不松口'],
  '规则优先级': ['永远压过'],
  'AI 腔禁用': ['作为 AI', '我理解你的感受'],
  '超时催问信号': ['怎么这么久', '我回来了'],
  '安全边界': ['色情', '自伤'],
};
for (const [label, phrases] of Object.entries(required)) {
  check(`人设覆盖：${label}`, () => {
    const missing = phrases.filter(p => !persona.includes(p));
    return missing.length === 0 || `缺少 ${missing.map(p => `「${p}」`).join('、')}`;
  });
}

// 开关与配置一致
check('尾鳍动作开关与文本一致', () => (config.tone.tailActions ? persona.includes('（尾鳍') : !persona.includes('（尾鳍')));
check('白饭开关与文本一致', () => (config.tone.riceJoke ? persona.includes('白饭') : !persona.includes('白饭')));
check('反胖梗开关与文本一致', () => (config.tone.antiFatJoke ? persona.includes('流线型') : !persona.includes('流线型')));
check('不存在「私聊默认就是主人」的 fail-open 表述', () =>
  (!persona.includes('默认就是主人') || '出现 fail-open 认主表述'));

for (const item of passed) console.log(`PASS ${item}`);
for (const item of failures) console.error(`FAIL ${item}`);
console.log(`\n${passed.length} passed, ${failures.length} failed; persona ${[...persona].length} 字`);
process.exit(failures.length === 0 ? 0 : 1);
