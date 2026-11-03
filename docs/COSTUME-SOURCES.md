# 服装素材来源与更新

现有写实服装 ID 与 CharaDB 的 440 个 ID 保持不变。

## ギア动漫服装

- 原站：[衣装集 アニメ版](https://ai-costume-anime-gallery.pages.dev/)，作者ギア（@giaaibusi）。
- 收录 1,320 条元数据，ID 为 `gia-anime-原ID`；一级分类为二次元，八个中文分类、名称、标签复用对应写实条目。
- 固定对照快照来自 [hongye007/open-pose-costume](https://github.com/hongye007/open-pose-costume/blob/f08f2e48675caeec85f091dde308cd906582b50f/data/source/costume-anime.json)，修订 `f08f2e48675caeec85f091dde308cd906582b50f`。
- 项目仅保存元数据快照及其 SHA-256；缩略图、预览图、PNG 原图直接请求原站，不批量下载、不镜像。图片使用条件以原作者说明为准，不能把本项目代码许可理解为图片再分发许可。
- 原站不可用时会影响图片加载。历史快照用于稳定目录和追溯，不构成图片备份。

## Shisei 中国历代服装

- 来源：[wquguru/shisei](https://github.com/wquguru/shisei)，固定修订 `8f61ceab10e45f8d3afd254900903733a0ba76ee`。
- 仅导入 `data/costumes.json` 的 HC 类服装：60 个候选，C007、C014、C015 没有图片，最终 57 套、227 个有效视角。没有导入 Shisei 姿势。
- 一级分类为现实，分类为中国历代，ID 为 `shisei-C001` 等。一套一张卡，详情支持正面、斜侧、侧面、背面中实际存在的视角。
- 标注 **Shisei / wquguru · AI 生成服装参考 · CC0**。这些素材是创作参考，并非专业历史服饰复原。
- 原项目图片及其自有数据为 CC0 1.0。固定版本的原文 [LICENSE-images](../data/shisei/LICENSE-images) 与 [NOTICE](../data/shisei/NOTICE) 随素材保留。CC0 本身不要求署名，本项目仍展示来源。
- 收录原始 w300/w900 WebP 各 227 张，共 454 个文件、6,054,726 字节（约 5.77 MiB），不重编码。每个文件的固定来源地址、大小与 SHA-256 记录在 `data/shisei/images-manifest.json`。

## 更新与复现

`python scripts/import_costume_sources.py` 从仓库快照重建两份中文目录及来源记录，不访问网络。图片已存在时同时重建其校验清单。

`python scripts/import_costume_sources.py --download-shisei` 仅下载缺失的 Shisei CC0 图片。网络无法访问 raw.githubusercontent.com 时，可加 `--github-cli /path/to/gh`，经已登录 GitHub CLI 的内容 API 获取同一固定修订；脚本不读取或输出令牌。

更换快照前，先审核上游修订、图片授权、条目数量和路径，更新脚本固定修订与数量约束，并重新核对清单。不要将动漫图片纳入下载流程。

配方保存 `selectedView` 及相应旧图片字段，旧配方无视角字段仍可使用。ComfyUI 的服装节点、角色配方节点新增可选 `costume_view`（默认 front）；不存在的非默认视角会明确报错。

ComfyUI 只读取服装目录中精确收录的远程原图地址，限制格式、10 MiB、2,000 万像素和 20 秒网络超时，不接受上游重定向。图库浏览器预览直接访问收录来源图片，不提供任意 URL 代理。
