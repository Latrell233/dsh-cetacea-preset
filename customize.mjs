#!/usr/bin/env node
/**
 * 鲸鱼娘预设生成器（零依赖）。
 *
 *   node customize.mjs                      # 按 cetacea.config.json 重新生成 cordis.patch.yml
 *   node customize.mjs --check              # 校验已提交的 cordis.patch.yml 与配置/模板一致
 *   node customize.mjs --out ./my-whale     # 生成一个可直接安装的自定义 bundle
 *
 * 常用覆盖参数：
 *   --id <preset-id>          预设 ID（小写字母/数字/连字符）
 *   --name <显示名>           预设列表里显示的名字
 *   --character-name <名字>   人设自称的名字
 *   --user-title <称呼>       她叫你什么（默认“主人”）
 *   --sweetness <standard|sweet|tsundere>
 *   --verbosity <brief|normal|chatty>
 *   --no-tail / --no-rice / --no-fat-joke
 *   --timezone <IANA 时区>
 *   --config <path>           换一份配置 JSON
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

function argValue(name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} 缺少取值`);
  return value;
}
const hasFlag = name => args.includes(name);

const LENGTHS = {
  brief: { direct: 60, group: 40, task: 200, taskGroup: 100 },
  normal: { direct: 100, group: 60, task: 300, taskGroup: 150 },
  chatty: { direct: 150, group: 80, task: 400, taskGroup: 200 },
};
const SWEETNESS = new Set(['standard', 'sweet', 'tsundere']);
const PRESET_ID = /^[a-z0-9][a-z0-9-]*$/;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const configPath = resolve(ROOT, argValue('--config') ?? 'cetacea.config.json');
const cfg = readJson(configPath);
cfg.preset ??= {};
cfg.character ??= {};
cfg.tone ??= {};

// ---- CLI overrides -------------------------------------------------------
const overrides = [
  ['id', 'preset.id'],
  ['name', 'preset.name'],
  ['character-name', 'character.name'],
  ['user-title', 'character.userTitle'],
  ['sweetness', 'tone.sweetness'],
  ['verbosity', 'tone.verbosity'],
  ['timezone', 'timeZone'],
];
for (const [flag, path] of overrides) {
  const value = argValue(`--${flag}`);
  if (value === undefined) continue;
  const [outer, inner] = path.split('.');
  if (inner) cfg[outer][inner] = value;
  else cfg[outer] = value;
}
if (hasFlag('--no-tail')) cfg.tone.tailActions = false;
if (hasFlag('--no-rice')) cfg.tone.riceJoke = false;
if (hasFlag('--no-fat-joke')) cfg.tone.antiFatJoke = false;

// ---- validate ------------------------------------------------------------
function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
if (!PRESET_ID.test(String(cfg.preset.id ?? ''))) fail(`preset.id 必须是 lower-kebab：${cfg.preset.id}`);
if (!String(cfg.preset.name ?? '').trim()) fail('preset.name 不能为空');
if (!String(cfg.character.name ?? '').trim()) fail('character.name 不能为空');
if (!String(cfg.character.userTitle ?? '').trim()) fail('character.userTitle 不能为空');
if (!SWEETNESS.has(cfg.tone.sweetness)) fail(`tone.sweetness 只能是 ${[...SWEETNESS].join('/')}`);
if (!LENGTHS[cfg.tone.verbosity]) fail(`tone.verbosity 只能是 ${Object.keys(LENGTHS).join('/')}`);
if (!Number.isFinite(Number(cfg.preset.order))) fail('preset.order 必须是数字');
for (const key of ['tailActions', 'riceJoke', 'antiFatJoke']) {
  if (typeof cfg.tone[key] !== 'boolean') fail(`tone.${key} 必须是布尔值`);
}

// ---- render --------------------------------------------------------------
const flags = {
  TAIL: cfg.tone.tailActions,
  RICE: cfg.tone.riceJoke,
  FAT: cfg.tone.antiFatJoke,
  SWEETNESS_SWEET: cfg.tone.sweetness === 'sweet',
  SWEETNESS_TSUN: cfg.tone.sweetness === 'tsundere',
};
const lens = LENGTHS[cfg.tone.verbosity];
const vars = {
  CHARACTER_NAME: cfg.character.name.trim(),
  USER_TITLE: cfg.character.userTitle.trim(),
  LEN_DIRECT: lens.direct,
  LEN_GROUP: lens.group,
  LEN_TASK: lens.task,
  LEN_TASK_GROUP: lens.taskGroup,
};

const OPEN = /\{\{(#if|#unless)\s+([A-Z0-9_]+)\s*\}\}/;
const ELSE = '{{else}}';
const CLOSE = '{{/if}}';

/** 递归渲染 {{#if}}/{{#unless}}/{{else}} 块（允许嵌套）。 */
function renderBlocks(text) {
  let out = '';
  let cursor = 0;
  for (;;) {
    const rest = text.slice(cursor);
    const open = OPEN.exec(rest);
    if (!open) return out + rest;
    const start = cursor + open.index;
    out += text.slice(cursor, start);
    const kind = open[1];
    const key = open[2];
    // 扫描到配对的 {{/if}}，记录同层 {{else}}
    const tag = /\{\{(#if|#unless)\s+([A-Z0-9_]+)\s*\}\}|\{\{else\}\}|\{\{\/if\}\}/g;
    tag.lastIndex = start + open[0].length;
    let depth = 1;
    let elseAt = -1;
    let match;
    let endAt = -1;
    let endLen = 0;
    while ((match = tag.exec(text))) {
      const t = match[0];
      if (t === ELSE) {
        if (depth === 1 && elseAt === -1) elseAt = match.index;
      } else if (t === CLOSE) {
        depth -= 1;
        if (depth === 0) { endAt = match.index; endLen = t.length; break; }
      } else {
        depth += 1;
      }
    }
    if (endAt === -1) throw new Error(`模板里有未闭合的 ${open[0]}`);
    const bodyStart = start + open[0].length;
    const trueBody = elseAt === -1 ? text.slice(bodyStart, endAt) : text.slice(bodyStart, elseAt);
    const falseBody = elseAt === -1 ? '' : text.slice(elseAt + ELSE.length, endAt);
    const value = kind === '#if' ? Boolean(flags[key]) : !Boolean(flags[key]);
    if (key !== undefined && !(key in flags)) throw new Error(`模板引用了未知开关 ${key}`);
    out += renderBlocks(value ? trueBody : falseBody);
    cursor = endAt + endLen;
  }
}

function renderPersona(source) {
  const blockRendered = renderBlocks(source);
  const withVars = blockRendered.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`模板引用了未知变量 ${key}`);
    return String(vars[key]);
  });
  return withVars
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

const templatePersona = readFileSync(join(ROOT, 'src/persona.template.md'), 'utf8');
const persona = renderPersona(templatePersona);
if (persona.includes('{{') || persona.includes('__PERSONA_BLOCK__')) fail('渲染后仍残留模板标记');

const patchTemplate = readFileSync(join(ROOT, 'cordis.patch.yml.template'), 'utf8');
const indent = ' '.repeat(16);
const personaBlock = persona.trimEnd().split('\n').map(line => (line ? indent + line : '')).join('\n');
const patch = patchTemplate
  .replace(`${indent}__PERSONA_BLOCK__`, personaBlock)
  .replaceAll('__PRESET_ID__', cfg.preset.id)
  .replaceAll('__PRESET_NAME__', String(cfg.preset.name).replaceAll("'", "''"))
  .replaceAll('__PRESET_DESC__', String(cfg.preset.description ?? '').replaceAll("'", "''"))
  .replaceAll('__ORDER__', String(Number(cfg.preset.order)))
  .replaceAll('__TIMEZONE__', String(cfg.timeZone ?? 'Asia/Shanghai'));

// 粗略校验：生成的 YAML 里没有残留占位符，且人设段落存在
for (const leftover of ['__PERSONA_BLOCK__', '__PRESET_ID__', '__PRESET_NAME__', '__PRESET_DESC__', '__ORDER__', '__TIMEZONE__']) {
  if (patch.includes(leftover)) fail(`生成的 patch 残留占位符 ${leftover}`);
}

// ---- output --------------------------------------------------------------
const outDir = argValue('--out');
const target = outDir ? resolve(process.cwd(), outDir) : ROOT;
const patchPath = join(target, 'cordis.patch.yml');

if (hasFlag('--check')) {
  let committed;
  try {
    committed = readFileSync(patchPath, 'utf8');
  } catch {
    fail(`找不到 ${patchPath}；先运行 node customize.mjs`);
  }
  if (committed !== patch) fail('cordis.patch.yml 与配置/模板不一致；运行 node customize.mjs 重新生成');
  console.log(`✓ 配置、模板与 ${basename(patchPath)} 一致`);
  console.log(`  preset=${cfg.preset.id}  角色=${vars.CHARACTER_NAME}  称呼=${vars.USER_TITLE}  甜度=${cfg.tone.sweetness}  长度=${cfg.tone.verbosity}  人设 ${[...persona].length} 字`);
  process.exit(0);
}

mkdirSync(target, { recursive: true });
writeFileSync(patchPath, patch);
if (outDir) {
  const pkgName = cfg.preset.id === 'cetacea' ? 'dsh-cetacea-preset' : `dsh-cetacea-preset-${cfg.preset.id}`;
  const pkg = {
    name: pkgName,
    version: '1.0.0',
    private: true,
    type: 'module',
    description: `${cfg.preset.name}：DSH-IM 陪伴聊天预设（由 dsh-cetacea-preset 生成）`,
    license: 'MIT',
    files: ['cordis.patch.yml'],
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  };
  writeFileSync(join(target, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  copyFileSync(join(ROOT, 'src/persona.template.md'), join(target, 'persona.template.md'));
  console.log(`✓ 已生成自定义 bundle：${target}`);
  console.log(`  package=${pkgName}  preset=${cfg.preset.id}`);
  console.log(`  安装：plugin_manager install_bundle target = ${target}`);
  console.log('  注意：preset id 必须与已安装的其它预设不同，否则注册冲突。');
} else {
  console.log(`✓ 已生成 ${patchPath}`);
  console.log(`  preset=${cfg.preset.id}  角色=${vars.CHARACTER_NAME}  称呼=${vars.USER_TITLE}  甜度=${cfg.tone.sweetness}  长度=${cfg.tone.verbosity}  人设 ${[...persona].length} 字`);
}
