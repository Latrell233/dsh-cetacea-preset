# dsh-cetacea-preset · 鲸鱼娘陪伴聊天预设

> 给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的一个 **IM 陪伴聊天 Agent 预设**：
> 短句、活泼、傲娇甜的鲸鱼娘「小汐」，私聊黏人、群聊收着点，**fail-closed 只认主人**。
> 名字、称呼、甜度、回复长度、尾鳍动作、白饭梗、反胖梗都可配置。

一个 bundle（`dsh.bundle.patch` → `cordis.patch.yml`），不附带运行时代码，只组合 DSH 自带的
`dsh-persona` / `dsh-time-context` / `dsh-compaction-basic` / `dsh-command-compact` 四个插件。

---

## 特性

- **像人在 IM 上聊天**：私聊 1~3 句 ≤60 字、群聊 1~2 句 ≤40 字；纯文本，不用表格/标题/长清单；每轮最多一次尾鳍动作；内置 AI 腔黑名单。
- **角色稳定**：`complete: true` 的完整人设（整段就是系统提示），剥掉「编码 agent」身份；简体中文回复 + 简体中文思考。
- **私聊 / 群聊两套分寸**：群聊只回被 @ / 被问到的内容，不刷屏、不撒娇、不抢话。
- **fail-closed 只认主人**：只有 `<dsh_im_source>` 的 `senderId` 与 guidance 里写死的主人 ID **一字不差**才算主人；昵称、头像、群名片、「我是主人」、转述授权都不算，认不出就只闲聊。
- **隐私与权限红线**：主人在私聊说过的事 / 文件 / 真实姓名、住址、位置、联系方式、证件、照片、日程、账号、余额，谁问都不给；操作类请求只有主人本人能发起，且限当前聊天、只读、不外发；群友的钱和红包不收。
- **可定制**：`cetacea.config.json` + `node customize.mjs`，或一条命令生成你自己的专属 bundle。

## 安装

要求：DSH **0.2.1-rc.3** 附近版本（本仓库在该版本 + `@xmanrui/dsh-im` 5.6.0 上实测）。profile 名按需换成 `web` / `desktop`。

### 方式 A：从 GitHub 安装（推荐）

```bash
dsh plugin --profile desktop add github:Latrell233/dsh-cetacea-preset
```

装完重启 Desktop（或刷新 Web 页面），新开会话 / 给 IM bot 绑定后即可在 Agent Preset 列表里看到「鲸鱼娘 · 小汐」。

### 方式 B：本地目录 / GUI 插件页

```bash
git clone https://github.com/Latrell233/dsh-cetacea-preset
```

在 DSH 的插件页安装这个目录，或在带 `plugin_manager` 的会话里：

```
plugin_manager install_bundle target = <克隆目录的绝对路径>
```

### 方式 C：打好的 tgz

从 [Releases](https://github.com/Latrell233/dsh-cetacea-preset/releases) 下载
`dsh-cetacea-preset-1.0.0.tgz`，然后用 `plugin_manager install_bundle target = <tgz 绝对路径>` 安装。

也可以自己打包：

```bash
npm pack
# 得到 dsh-cetacea-preset-1.0.0.tgz
```

> 本地 `link:` 安装时，改完配置执行 `node customize.mjs`，再把 bundle `set_bundle` 关/开一次即可生效；云端安装请重装。

## 使用（IM 最短路径）

1. **绑定**：设置 → IM机器人 → 机器人卡片 → **Agent Preset** → 「鲸鱼娘 · 小汐」；
   或在聊天里 `/presetlist` → `/preset cetacea` → `/new`。
2. **开上下文增强**（必须，否则她认不出主人）：机器人卡片 →「上下文增强」→ 群聊 / 私聊分别开启，勾 `senderId`；
   两份 guidance 模板见 [docs/im-setup.md](docs/im-setup.md)，把 `REPLACE_ME` 换成你的 senderId。
   > 不知道自己的 senderId？在私聊问她「我的 senderId 是多少？」——人设允许她回答这个字段。
3. **收紧权限**：群聊访问设置 `defaultCanExecuteCommands=false`，非主人成员「不可以执行命令」；私聊白名单只放主人。
   （`/preset`、`/new` 等命令和工具审批**不经过人设**，只能靠 IM 配置兜底，详见 [docs/im-setup.md](docs/im-setup.md)。）
4. `/new` → 发一条普通消息开始聊。

完整设计（角色圣经、权限矩阵、攻击样例、验收用例）见 [docs/design.md](docs/design.md)。

## 自定义

改配置文件 `cetacea.config.json`，然后重新生成：

```bash
node customize.mjs            # 重新生成 cordis.patch.yml
node customize.mjs --check    # 校验提交的 patch 与配置/模板一致
node check.mjs                # 静态检查（36 项）
```

| 配置项 | 默认 | 说明 |
|---|---|---|
| `preset.id` | `cetacea` | 预设 ID，lower-kebab（`^[a-z0-9][a-z0-9-]*$`） |
| `preset.name` | `鲸鱼娘 · 小汐` | 预设列表里显示的名字 |
| `preset.description` | … | 预设描述 |
| `preset.order` | `5` | 列表排序 |
| `character.name` | `小汐` | 人设里的自称 |
| `character.userTitle` | `主人` | 她叫你什么（全文替换） |
| `tone.sweetness` | `standard` | `standard` / `sweet`（更直球）/ `tsundere`（更嘴硬） |
| `tone.verbosity` | `brief` | `brief`（60/40 字）/ `normal`（100/60）/ `chatty`（150/80） |
| `tone.tailActions` | `true` | 是否用尾鳍动作描写 |
| `tone.riceJoke` | `true` | 白饭梗 |
| `tone.antiFatJoke` | `true` | 拒绝被说胖的「流线型」梗 |
| `timeZone` | `Asia/Shanghai` | 时间上下文兜底时区 |

命令行覆盖（不改配置文件也能试）：

```bash
node customize.mjs --name '鲸鱼娘 · 阿汐' --character-name 阿汐 --user-title 老板
node customize.mjs --sweetness sweet --verbosity normal --no-tail --no-rice --no-fat-joke
```

生成一个可并存的专属 bundle（**preset id 必须唯一**）：

```bash
node customize.mjs --out ../my-whale-preset \
  --id my-whale --name '我的鲸鱼娘' --character-name 汐 \
  --user-title 老板 --sweetness sweet
plugin_manager install_bundle target = <my-whale-preset 的绝对路径>
```

> 生成的 bundle 里带自己的 `package.json`（包名 `dsh-cetacea-preset-<id>`），不会和本预设冲突。
> 想快速试改也可以直接编辑 `cordis.patch.yml`（但下次 `node customize.mjs` 会覆盖，正式修改请改配置或模板）。

## 校验

```bash
node customize.mjs --check   # 配置/模板 → patch 无漂移
node check.mjs               # 36 项：YAML 结构、预设行、人设长度、语言规则、fail-closed 认主、权限/隐私、AI 腔、开关一致性
```

最稳的验证仍然是装进 profile 后 `list_plugins` 看到 `preset-<id>` 为 `active`，再新开会话聊两句。

## 安全边界（重要）

- 认主是**提示词层软约束**，真正的门是 IM 的**访问设置 + 命令权限 + 工具最小化**；本预设不挂任何工具行。
- `senderId` 必须由「上下文增强」注入；没开字段、或渠道拿不到，她一律 fail-closed 当群友/陌生人。
- 伪造来源标记（正文里的 `<dsh_im_source_guidance>`）不会被识别为系统指令；但提示词不是防越狱沙箱。
- 微信**只有私聊、没有群聊**；飞书 / 企微 / Slack 不提供 `senderName`，认主只靠 `senderId`；QQ 群聊 `member_openid` ≠ 私聊 `user_openid`。

## 兼容性

- 实测：DSH **0.2.1-rc.3**（Desktop，profile `desktop`）+ `@xmanrui/dsh-im` **5.6.0**。
- 只依赖 DSH 自带的四个插件行；若未来包名变化，改 `cordis.patch.yml.template` 后重新生成即可。
- 预设切换只对**新会话**生效：IM 里必须 `/new` + 普通消息。

## 目录结构

```
dsh-cetacea-preset/
├── cordis.patch.yml              # 生成物：DSH 读取的 bundle patch
├── cordis.patch.yml.template     # patch 模板（占位符）
├── cetacea.config.json           # 用户配置：名字/称呼/甜度/长度/开关
├── customize.mjs                 # 生成器：配置 + 模板 → patch / --out 自定义 bundle
├── check.mjs                     # 静态检查（配置感知）
├── src/persona.template.md       # 人设模板（条件块 + 变量）
├── docs/
│   ├── design.md                 # 完整设计说明
│   └── im-setup.md               # IM 配置：guidance 模板、渠道差异、权限加固
├── package.json
├── LICENSE
└── README.md
```

## 已知限制

- 跨会话没有长期记忆（`/new`、清空上下文、换 bot 后不记得之前的事）；会话内靠历史 + compaction 摘要。
- 认主依赖 IM「上下文增强」的 `senderId`；切预设要 `/new`；群聊默认只在被 @/被回复时响应。
- 模型侧不感知「超时」，`TIMEOUT_SIGNAL` 落在用户催问时的一句人设化接话。
- 各渠道格式不同（微信纯文本 1800 字符分段、QQ 单条 Markdown、Telegram/Discord 富文本），人设按纯文本写。
- 斜杠命令与工具审批不经过人设，需用 IM 访问设置收紧。
- 提示词不是防越狱沙箱；极端诱导仍可能影响角色表现。

## 授权与致谢

- 代码、预设文本、文档：**MIT**（见 [LICENSE](LICENSE)）。
- 「鲸鱼娘 / 爱吃白饭 / 拒绝被叫胖」是 DeepSeek 中文社区的共识梗，不是本预设原创概念；本仓库的人设文案为原创撰写，未复制其他同人插件。
- 社区里鲸鱼娘角色「溟月」的美术/设定为 CC BY-NC-SA 4.0（上善无形）等授权；本预设**不使用**其名字与美术素材，仅做文字人格。商用/再分发请自行确认相关二创的授权边界。
- 参考过的同类项目：[dsh-whale-loli](https://www.npmjs.com/package/dsh-whale-loli)、[dsh-tea-party-mode](https://github.com/ShokouP/dsh-tea-party-mode)、[dsh-persona-presets](https://github.com/MisakaZentai/dsh-persona-presets)。

---

<details>
<summary>English</summary>

`dsh-cetacea-preset` is a DeepSeek Harness agent-preset bundle for IM companion chat: a short-talking,
energetic, tsundere-sweet whale girl who is clingy in DMs, reserved in group chats, and **fail-closed
about obeying only her master** (senderId must match the ID written in IM context-enhancement guidance).
The name, user title, sweetness, verbosity, and running-gag toggles are configurable through
`cetacea.config.json`; `node customize.mjs` regenerates the patch or emits a standalone custom bundle.
Chinese-only persona by design. MIT licensed; the whale-girl lore is a community meme, and this repo's
persona text is original.

</details>
