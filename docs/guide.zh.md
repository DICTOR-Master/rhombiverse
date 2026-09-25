# Rhombiverse 使用指南

Rhombiverse 和它的孪生网站 [Polyhedraverse](https://polyhedraverse.vercel.app) 是观察同一种几何的两种方式。Rhombiverse 是**风景**：向四面八方延伸的晶格本身。Polyhedraverse 是**肖像画廊**：住在这些晶格里的形状，一次一个，近距离展示。

在这里，每个部件都在真实的晶体晶格上无缝地填满空间，所以只能把部件放在晶格有空位的地方。轻点添加部件，长按移除部件，再用不同的视图在 2D、3D 或 4D 中查看你的作品。

本指南的第一部分介绍常用操作，第二部分列出所有控件。

按钮名称按应用中显示的样子书写（应用尚未翻译的名称保留英文）。

## 入门

### 选择维度

按下 **ENTER** 后会打开维度选择器：一个缓慢旋转的立体，它的面分别是 **2D**、**3D** 和 **4D**，每个面都有图标。将鼠标悬停在面上（触屏上长按）可以看到名称，然后轻点你想要的面。拖动可以转动立体，把其他面转到前面。

之后可以通过 **菜单 → Change Dimension** 切换，或者使用左上角的 **Wizard**，它列出了每个维度的所有晶格，以及各自部件的旋转线框。

### 放置第一个部件

空的世界里会在第一个部件的位置显示一个**青色轮廓**。轻点它。然后轻点任意部件的一个面（在 2D 中是一条边），就会在它的另一侧添加一个相邻部件。

部件一次放一个。3D 一开始选中的是 **RD**（菱形十二面体）。当前要放置的部件显示在左下角的 **Shape** 按钮上；轻点它可以换一个部件。

### 移除部件

- **手机或平板：** 长按部件。
- **鼠标：** 右键点击部件。右键在任何模式下都会移除。

要撤销上一次更改，请轻点右下角的 **Undo**（↶）。按住可以一次回退好几步。每个维度都有自己的撤销历史，所以在 2D 中撤销不会影响你在 3D 或 4D 中的作品。

### 移动镜头

- **旋转：** 单指拖动，或按住鼠标左键拖动。
- **缩放：** 双指捏合，或使用滚轮。
- **平移：** 双指拖动。

## 选择要搭建的内容

### 按晶格分类的部件

**2D：** Parallelogram（平行四边形）、Triangle（三角形）、Hexagon（六边形）、Kite（筝形）和 Kagome（笼目）瓷砖，在顶部面板中选择，每种最多有四个晶格角度（90°、70.53°、63.43° 和 60°）。

**3D：**

| 晶格 | 部件 |
|---|---|
| FCC | Rhombic Dodecahedron（RD，菱形十二面体）、Hemi RD、Hourglass、RD Quarter、Cube、Pyramid |
| RD Dual | Cuboctahedron（CO，立方八面体）、Octahedron（八面体） |
| BCC | Truncated Octahedron（TO，截角八面体） |
| BCC Interstitial | Flattened Octahedron、Disphenoid |
| Elongated Dodecahedron | Elongated Dodecahedron（ED，伸长十二面体） |
| Hexagonal | Hex Prism（六棱柱） |
| Rhombohedral | Rhombohedra（菱面体） |
| Pyrochlore（3D 笼目） | Truncated Tetrahedron（截角四面体；它们之间的四面体会自动添加） |

**4D：**

| 世界 | 部件 |
|---|---|
| Z4 | Tesseract（4D 立方体） |
| D4 | 24-cell、16-cell |
| Hyper-pyrochlore（4D 笼目） | 5-cell、Truncated 5-cell、Bitruncated 5-cell |

在 FCC 上试试：放六个 Pyramid 组成一个 Cube。然后在 Cube 的每个面上各加一个 Pyramid，它就变成了 RD。再把这六个移除，就回到 Cube。

**RD Quarter** 是 RD 分割成的 4 个菱面体之一。在 RD 的某个角附近轻点，就会填上那个角；再轻点某个 Quarter 的面，就会在那个面的另一侧放上它的镜像。镜像总是落回 RD 晶格上，所以你可以让 Quarter 一格一格地生长。如果想要既能 Mirror（镜像）也能 Copy（复制）的自由菱面体晶格，请使用 **Rhombohedra**。

### 颜色

轻点左下角的**颜色按钮**，可以从 14 种颜色中选择。你选的颜色会跟着当前要放置的部件。在设置中打开 **根据部件类型自动分配颜色** 后，在你选择颜色之前，每种部件都会以自己的颜色开始。

## 查看你的作品

| 视图 | 显示内容 | 如何打开 |
|---|---|---|
| World View | 彩色、半透明或骨架 | 轻点 World View 按钮循环切换 |
| Lattice View | 你的作品，以及所选部件向外一步的所有空位 | 轻点 Lattice View 按钮循环切换部件 |
| X-Ray | 剖切。可以把切面拖过结构，也可以斜着拖 | X-Ray 按钮（⛶） |
| Spherical | 把每个部件显示成近似球体 | Spherical 按钮（◯） |
| Duality | 这种晶体结构投射出的非周期镶嵌 | Duality 按钮（◐） |
| BCC Lattice | 嵌套在 FCC 晶格中的体心立方晶格 | BCC Lattice 按钮（⬡） |
| Dualize | 交换 FCC 和 BCC | 设置 → Dualize Preview |

设置中还有 **剖面视图**：选择一个轴，拖动滑块移动切面，勾选 **翻转** 可以看到另一侧。

## 进入 4D

1. 在维度选择器、Wizard 或 **菜单 → Change Dimension** 中选择 **4D**。
2. 选择一个世界：Tesseract（Z4）、24-cell 或 16-cell（D4），或者一个 Hyper-pyrochlore 部件。
3. 像在 3D 中一样搭建：轻点一个面，添加相邻的 4D 胞。

屏幕底部会出现 4D 面板。

- **Slice / Projection** 切换观看 4D 的方式。**Slice**（默认）显示当前深度处的 3D 截面。**Projection** 把完整的 4D 胞显示为影子；轻点影子的面就能从那里继续搭建。在 Projection 中还可以在 **Parallel**（平行）和 **Perspective**（透视）之间切换。
- **滑块** 的作用取决于它上方的按钮：**W-depth** 让截面沿第四维移动，**XW**、**YW** 和 **ZW** 让它朝第四维旋转。它会在有用的位置自动停靠。标着 **FCC** 的位置就是普通的 3D RD 世界，标着 **Pyrochlore** 的位置就是 3D Pyrochlore 世界。
- **Reset 4D** 把一切恢复到初始位置。
- **Info** 打开一个面板，显示当前的世界和要放置的部件、你已搭建的内容、截面所在位置（W-depth 或 Projection）、XW/YW/ZW 旋转角度，以及你最后轻点或放置的胞的 4D 中心坐标。

## 保存你的作品

每次更改后，你的世界（所有维度）都会自动保存在这个浏览器中。在同一台设备、同一个浏览器上重新打开网站，它就会回来。

在 **设置** 中：

- **导出世界** 把所有内容（每个 3D 晶格、你的 2D 瓷砖和 4D 作品）保存到一个文件中。可以用来备份，或把世界转移到另一台设备。
- **导入世界** 打开导出的文件。**Undo** 可以撤销导入。
- **新建世界** 用空世界重新开始。角落轮盘上的 **Clear World**（⊘）作用相同。Undo 可以恢复。

## 学习数学

- **Almanac：** 每种部件和晶格背后的数学与几何。从 菜单 → Almanac 打开。
- **What's New** 列出最近的更改。

---

# 控件参考

## 屏幕按钮

| 控件 | 作用 |
|---|---|
| Wizard（左上） | 浏览各个维度和晶格及其部件 |
| Shape（左下） | 当前要放置的部件。轻点更换 |
| 颜色（左下） | 搭建颜色。轻点更换 |
| Lattice View | 在 Off 和每种部件的视图之间循环 |
| Rhombohedra 连接方式 | 仅在 Rhombohedra 时显示：在 Copy 和 Mirror 之间切换 |
| Undo（↶，右下） | 轻点撤销当前维度的一步。按住可继续回退 |
| 菜单 | 打开菜单轮盘（键盘：Tab 或空格） |

## 角落轮盘

拖动角落里的小轮盘来转动它，轻点一个面来使用。

| 符号 | 控件 |
|---|---|
| ⚙ | 设置 |
| ⛶ | X-Ray |
| ◐ | Duality |
| ⬡ | BCC Lattice |
| ◇ | 菜单 |
| ⊘ | Clear World |
| ↻ | Reload（看起来卡住时使用） |
| ◯ | Spherical |
| — | World View、Cuboctahedron Build |

## 菜单轮盘

菜单是一个菱形十二面体。每个面是一个分区：轻点一个面打开它，用 **Home** 返回。**Settings** 和 **Almanac** 总在顶部的面上。

| 分区 | 内容 |
|---|---|
| Home | Piece、Color、Change Dimension |
| Piece | RD family、Cube、Pyramid、TO、Flattened Octahedron、Disphenoid、CO、Octahedron |
| RD family | RD、Hemi RD、Hourglass、RD Quarter、ED、Hex Prism、Rhombohedra、Pyrochlore |
| Change Dimension | 2D、3D、4D |

## 设置

| 设置 | 作用 |
|---|---|
| 视角灵敏度 | 镜头旋转速度 |
| 反转Y轴 | 反转上下拖动方向 |
| 视野 | 镜头的宽度 |
| 画面质量 | 低、中或高 |
| 显示帧率计 | 帧率计数器 |
| 音量 | 声音大小 |
| 语言 | English、日本語、Español、Français、한국어、中文、Русский |
| 根据部件类型自动分配颜色 | 为每种部件指定各自的颜色 |
| 剖面视图、轴、位置、翻转 | 沿一个轴剖切 |
| Build Cuboctahedron、Dualize Preview | 特殊搭建模式 |
| 新建世界、导出世界、导入世界 | 重新开始、备份和恢复（所有维度） |

## 键盘和鼠标

| 输入 | 操作 |
|---|---|
| 左键点击一个面 | 添加部件 |
| 右键点击部件 | 移除它 |
| 左键拖动 | 旋转镜头 |
| 滚轮 | 缩放 |
| Tab 或空格 | 打开菜单轮盘 |
| Escape | 关闭菜单、Wizard 或 Almanac |
| Enter | 从欢迎界面进入 |

## 触屏

| 手势 | 操作 |
|---|---|
| 轻点一个面 | 添加部件 |
| 长按部件 | 移除它 |
| 单指拖动 | 旋转镜头 |
| 双指捏合 | 缩放 |
| 双指拖动 | 平移 |
