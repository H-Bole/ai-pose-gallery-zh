# 第三方来源与适配说明

核实日期：2026-11-03。本次未引入运行时依赖；不能将包含以下适配的整库称为“全部从零原创”。`assets/*.svg` 为本项目自行绘制的几何卡面，不含游戏角色、卡面、商标或外部纹理。

## cards-css：MIT 光学结构适配

- 来源：[kongyo2/cards-css](https://github.com/kongyo2/cards-css/tree/cd25c33682922c3af89b470a79dc2185597034ed)
- 固定提交：`cd25c33682922c3af89b470a79dc2185597034ed`
- 核实范围：该提交 `LICENSE`、`src/styles/effects/prism.css`、`src/styles/effects/oilslick.css`。
- 适配位置：`src/optics.js` 的 `otherSurface()` 中 prism-facet / oil-interference 两个分支，分别供 `other-prism-holo`、`other-oil-film` 使用。
- 修改范围：将棱镜重复锥形色带、独立窄反射与油膜双径向色带的材质构造转换为单pass GLSL角向/径向场；重写颜色函数、输入归一化、明暗及与底图的合成。没有引入该仓CSS选择器、DOM、组件、图片、纹理、其他效果或运行时。不是CSS逐像素等价移植，也不声称独立从零设计了这些材质构造。
- 原始文件SHA256：LICENSE `3363f66adb2645b6020ef4d0281c2549e83dbda514ad30117b7e024044ce72b0`；prism.css `6390dfb0e64dbcfd44a4df756a5501628b58f66163b981d8f6faa6d734a22c38`；oilslick.css `9c8e898fa590f7b732b58fe0294a3311ac15a61e3581f8f916c59abdb8899477`。

以下为该来源完整许可，分发包含适配的源码及独立HTML时应一并保留：

```text
MIT License

Copyright (c) 2026 kongyo2

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Hologramism：公开说明中的浮雕观感参考

- 来源：[alexdonh/hologramism](https://github.com/alexdonh/hologramism/tree/14f698349806975ccee516bec45ead94fb192bb0)
- 固定提交：`14f698349806975ccee516bec45ead94fb192bb0`
- 核实范围：公开README中边缘倒角、形状浮雕与设备姿态驱动的效果说明及该提交LICENSE（MIT，Copyright (c) 2026 Alex Do；LICENSE SHA256 `2b2d53729608ef7cf2db5d6ab8ee3591b2a4f53f4bfdaf517affabb28e5ca81e`）。
- 使用范围：作为暗金浮雕/银质雕花的观感参考；未复制源码、shader、素材或绑定层，未下载或集成WASM/WebGPU引擎。当前法线/高度烘焙与单pass光照在本仓实现；不是该引擎的移植，也不声称视觉等价。
- 本次没有复制three.js代码或bumpmap实现，因此没有新增three.js依赖或对应代码许可。

本文件描述上述固定来源与适配范围。自制样图与程序生成的缩略图按项目 MIT 许可分发；assets/brand 下个人品牌标志单独授权用于本项目展示，不包含在 MIT 软件许可中。
