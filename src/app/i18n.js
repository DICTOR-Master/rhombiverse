// UI-chrome i18n for the main Rhombiverse app -- direct user request,
// 2026-09-17, unifying the language set across all three sister apps
// (Polyhedraverse already shipped this exact same 7-language set:
// polyhedraverse/app/lib/i18n.ts, same file shape, ported here since
// this app is plain ES modules rather than TypeScript/React). Same
// scoping discipline as that file: covers ONLY this app's own
// interface strings (buttons, panel headers, hints, tooltips) -- never
// material/species/piece-type/world-preset names, "the same way a
// karaoke machine never translates a song title."
//
// Phase 1 (this file, 2026-09-17): the always-visible chrome (HUD,
// Settings panel basics, walk mode, World import/export/sharing,
// Shells, Gallery, Welcome overlay). Deliberately NOT yet covered, a
// follow-up phase: the Sculpt panel, the Cultivate panel, the "Your Own
// AI" BYOK section, the gravity-info/evolution-info simulation-status
// hints (heavily interpolated, multi-clause -- need their own
// decomposition design, not a straight swap), and the hidden/superseded
// "Advanced Building" mode-button row.
//
// Persisted via settings.js's own `language` field (SETTINGS_KEY
// 'rhombiverse-settings') -- the same store already used for
// sensitivity/FOV/quality/volume, not a new mechanism. RHOMBIS
// (src/rhombis/) reads/writes the SAME field via a direct import of
// settings.js, so a language choice made in either app is honored in
// both (same origin, same localStorage key).

export const LANG_ORDER = ['en', 'ja', 'es', 'fr', 'ko', 'zh', 'ru'];

export const LANG_META = {
  en: { native: 'English' },
  ja: { native: '日本語' },
  es: { native: 'Español' },
  fr: { native: 'Français' },
  ko: { native: '한국어' },
  zh: { native: '中文' },
  ru: { native: 'Русский' },
};

const en = {
  'hud.menu': 'Menu',
  'hud.settings': 'Settings',
  'lab.close': 'Close',
  'lab.rhombisLinkHint': 'New here, or just want a quick puzzle? <a href="./rhombis.html">Try RHOMBIS</a> any time.',
  'setting.sensitivity': 'Look sensitivity',
  'setting.invertY': 'Invert Y',
  'setting.fov': 'Field of view',
  'setting.quality': 'Graphics quality',
  'setting.quality.low': 'Low',
  'setting.quality.medium': 'Medium',
  'setting.quality.high': 'High',
  'setting.fpsMeter': 'Show FPS meter',
  'setting.volume': 'Volume',
  'setting.language': 'Language',
  'color.label': 'Color:',
  'color.autoAssign': 'Auto-assign color by piece type',
  'piece.label': 'Piece:',
  'piece.tryHint': 'Try placing 6 pyramids on a cube. Then 12. Then remove the outer 6.',
  'world.view': 'World view:',
  'world.view.color': 'Color',
  'world.view.translucent': 'Translucent',
  'world.view.skeleton': 'Skeleton',
  'world.sectionView': 'Section view',
  'world.flip': 'Flip',
  'world.rightClickHint': 'Right-click always removes the clicked cell, in every mode.',
  'world.new': 'New World',
  'world.exportJson': 'Export World',
  'world.import': 'Import World',
  'shells.undoTitle': 'Click: undo one step. Hold: scrub to any past state.',
  'welcome.rhombisLink': 'New here? Try RHOMBIS, our 3D intro puzzle &rarr;',
  'welcome.polyhedraverseLink': 'Check out Polyhedraverse, our twin shape-editing site &rarr;',
  'welcome.aboutTitle': 'About Rhombiverse',
  'welcome.overview': 'The landscape view: lattices of space-filling shapes, in 2D, 3D and 4D.',
  'welcome.howTo': 'How to use &rarr;',
};

const ja = {
  'hud.menu': 'メニュー',
  'hud.settings': '設定',
  'lab.close': '閉じる',
  'lab.rhombisLinkHint': '初めての方、またはちょっとしたパズルをお探しなら？ <a href="./rhombis.html">RHOMBISを試す</a> をいつでもどうぞ。',
  'setting.sensitivity': '視点の感度',
  'setting.invertY': 'Y軸反転',
  'setting.fov': '視野角',
  'setting.quality': 'グラフィック品質',
  'setting.quality.low': '低',
  'setting.quality.medium': '中',
  'setting.quality.high': '高',
  'setting.fpsMeter': 'FPSメーターを表示',
  'setting.volume': '音量',
  'setting.language': '言語',
  'color.label': '色:',
  'color.autoAssign': 'ピースの種類に応じて色を自動割り当て',
  'piece.label': 'ピース:',
  'piece.tryHint': 'まず立方体にピラミッドを6個置いてみましょう。次に12個。そして外側の6個を外してみましょう。',
  'world.view': 'ワールド表示:',
  'world.view.color': 'カラー',
  'world.view.translucent': '半透明',
  'world.view.skeleton': 'スケルトン',
  'world.sectionView': '断面表示',
  'world.flip': '反転',
  'world.rightClickHint': 'どのモードでも、右クリックでクリックしたセルを常に削除します。',
  'world.new': '新しいワールド',
  'world.exportJson': 'ワールドをエクスポート',
  'world.import': 'ワールドをインポート',
  'shells.undoTitle': 'クリック: 1手戻る。長押し: 過去の状態をスクラブ。',
  'welcome.rhombisLink': '初めての方はこちら？ 3D入門パズル「RHOMBIS」を試す &rarr;',
  'welcome.polyhedraverseLink': '姉妹サイト「Polyhedraverse」もチェックしてみてください &rarr;',
  'welcome.aboutTitle': 'Rhombiverseについて',
  'welcome.overview': 'ランドスケープ（風景）ビュー：空間を埋め尽くす形の格子を、2D・3D・4Dで。',
  'welcome.howTo': '使い方 &rarr;',
};

const es = {
  'hud.menu': 'Menú',
  'hud.settings': 'Ajustes',
  'lab.close': 'Cerrar',
  'lab.rhombisLinkHint': '¿Eres nuevo, o solo quieres un rompecabezas rápido? <a href="./rhombis.html">Prueba RHOMBIS</a> cuando quieras.',
  'setting.sensitivity': 'Sensibilidad de la vista',
  'setting.invertY': 'Invertir eje Y',
  'setting.fov': 'Campo de visión',
  'setting.quality': 'Calidad gráfica',
  'setting.quality.low': 'Baja',
  'setting.quality.medium': 'Media',
  'setting.quality.high': 'Alta',
  'setting.fpsMeter': 'Mostrar medidor de FPS',
  'setting.volume': 'Volumen',
  'setting.language': 'Idioma',
  'color.label': 'Color:',
  'color.autoAssign': 'Asignar color automáticamente según el tipo de pieza',
  'piece.label': 'Pieza:',
  'piece.tryHint': 'Prueba a colocar 6 pirámides en un cubo. Luego 12. Luego quita las 6 exteriores.',
  'world.view': 'Vista del mundo:',
  'world.view.color': 'Color',
  'world.view.translucent': 'Translúcido',
  'world.view.skeleton': 'Esqueleto',
  'world.sectionView': 'Vista de sección',
  'world.flip': 'Invertir',
  'world.rightClickHint': 'Clic derecho siempre elimina la celda pulsada, en cualquier modo.',
  'world.new': 'Mundo Nuevo',
  'world.exportJson': 'Exportar Mundo',
  'world.import': 'Importar Mundo',
  'shells.undoTitle': 'Clic: deshace un paso. Mantener pulsado: recorre cualquier estado anterior.',
  'welcome.rhombisLink': '¿Eres nuevo? Prueba RHOMBIS, nuestro rompecabezas introductorio en 3D &rarr;',
  'welcome.polyhedraverseLink': 'Descubre Polyhedraverse, nuestro sitio gemelo de edición de formas &rarr;',
  'welcome.aboutTitle': 'Acerca de Rhombiverse',
  'welcome.overview': 'La vista de paisaje: redes de formas que llenan el espacio, en 2D, 3D y 4D.',
  'welcome.howTo': 'Cómo usarlo &rarr;',
};

const fr = {
  'hud.menu': 'Menu',
  'hud.settings': 'Paramètres',
  'lab.close': 'Fermer',
  'lab.rhombisLinkHint': 'Nouveau ici, ou juste envie d\'un puzzle rapide ? <a href="./rhombis.html">Essayez RHOMBIS</a> à tout moment.',
  'setting.sensitivity': 'Sensibilité de la vue',
  'setting.invertY': 'Inverser l\'axe Y',
  'setting.fov': 'Champ de vision',
  'setting.quality': 'Qualité graphique',
  'setting.quality.low': 'Basse',
  'setting.quality.medium': 'Moyenne',
  'setting.quality.high': 'Haute',
  'setting.fpsMeter': 'Afficher le compteur de FPS',
  'setting.volume': 'Volume',
  'setting.language': 'Langue',
  'color.label': 'Couleur :',
  'color.autoAssign': 'Assigner automatiquement la couleur selon le type de pièce',
  'piece.label': 'Pièce :',
  'piece.tryHint': 'Essayez de placer 6 pyramides sur un cube. Puis 12. Puis retirez les 6 extérieures.',
  'world.view': 'Vue du monde :',
  'world.view.color': 'Couleur',
  'world.view.translucent': 'Translucide',
  'world.view.skeleton': 'Squelette',
  'world.sectionView': 'Vue en coupe',
  'world.flip': 'Retourner',
  'world.rightClickHint': 'Le clic droit supprime toujours la cellule cliquée, dans tous les modes.',
  'world.new': 'Nouveau Monde',
  'world.exportJson': 'Exporter le Monde',
  'world.import': 'Importer un Monde',
  'shells.undoTitle': 'Clic : annule une étape. Maintenir : parcourt tout état antérieur.',
  'welcome.rhombisLink': 'Nouveau ici ? Essayez RHOMBIS, notre puzzle d\'introduction en 3D &rarr;',
  'welcome.polyhedraverseLink': 'Découvrez Polyhedraverse, notre site jumeau d\'édition de formes &rarr;',
  'welcome.aboutTitle': 'À propos de Rhombiverse',
  'welcome.overview': 'La vue paysage : des réseaux de formes qui remplissent l\'espace, en 2D, 3D et 4D.',
  'welcome.howTo': 'Mode d\'emploi &rarr;',
};

const ko = {
  'hud.menu': '메뉴',
  'hud.settings': '설정',
  'lab.close': '닫기',
  'lab.rhombisLinkHint': '처음이신가요, 아니면 간단한 퍼즐을 원하시나요? 언제든 <a href="./rhombis.html">RHOMBIS 해보기</a>.',
  'setting.sensitivity': '시점 감도',
  'setting.invertY': 'Y축 반전',
  'setting.fov': '시야각',
  'setting.quality': '그래픽 품질',
  'setting.quality.low': '낮음',
  'setting.quality.medium': '중간',
  'setting.quality.high': '높음',
  'setting.fpsMeter': 'FPS 표시기 보기',
  'setting.volume': '음량',
  'setting.language': '언어',
  'color.label': '색상:',
  'color.autoAssign': '조각 종류에 따라 색상 자동 지정',
  'piece.label': '조각:',
  'piece.tryHint': '큐브에 피라미드 6개를 놓아보세요. 그다음 12개. 그다음 바깥쪽 6개를 제거해보세요.',
  'world.view': '월드 보기:',
  'world.view.color': '컬러',
  'world.view.translucent': '반투명',
  'world.view.skeleton': '스켈레톤',
  'world.sectionView': '단면 보기',
  'world.flip': '반전',
  'world.rightClickHint': '어떤 모드에서든 우클릭하면 클릭한 셀이 항상 제거됩니다.',
  'world.new': '새 월드',
  'world.exportJson': '월드 내보내기',
  'world.import': '월드 가져오기',
  'shells.undoTitle': '클릭: 한 단계 되돌리기. 길게 누르기: 과거 상태로 이동.',
  'welcome.rhombisLink': '처음이신가요? 3D 입문 퍼즐 RHOMBIS를 해보세요 &rarr;',
  'welcome.polyhedraverseLink': '자매 사이트인 Polyhedraverse(도형 편집)도 확인해보세요 &rarr;',
  'welcome.aboutTitle': 'Rhombiverse 정보',
  'welcome.overview': '풍경 보기: 공간을 빈틈없이 채우는 도형들의 격자를 2D, 3D, 4D로.',
  'welcome.howTo': '사용 방법 &rarr;',
};

const zh = {
  'hud.menu': '菜单',
  'hud.settings': '设置',
  'lab.close': '关闭',
  'lab.rhombisLinkHint': '初次来访，或只想玩个快速解谜？随时<a href="./rhombis.html">试试 RHOMBIS</a>。',
  'setting.sensitivity': '视角灵敏度',
  'setting.invertY': '反转Y轴',
  'setting.fov': '视野',
  'setting.quality': '画面质量',
  'setting.quality.low': '低',
  'setting.quality.medium': '中',
  'setting.quality.high': '高',
  'setting.fpsMeter': '显示帧率计',
  'setting.volume': '音量',
  'setting.language': '语言',
  'color.label': '颜色：',
  'color.autoAssign': '根据部件类型自动分配颜色',
  'piece.label': '部件：',
  'piece.tryHint': '试试在立方体上放置6个金字塔，然后是12个，再移除外侧的6个。',
  'world.view': '世界视图：',
  'world.view.color': '彩色',
  'world.view.translucent': '半透明',
  'world.view.skeleton': '骨架',
  'world.sectionView': '剖面视图',
  'world.flip': '翻转',
  'world.rightClickHint': '在任何模式下，右键点击都会移除被点击的单元格。',
  'world.new': '新建世界',
  'world.exportJson': '导出世界',
  'world.import': '导入世界',
  'shells.undoTitle': '点击：撤销一步。长按：拖动查看历史状态。',
  'welcome.rhombisLink': '初次来访？试试我们的3D入门解谜游戏 RHOMBIS &rarr;',
  'welcome.polyhedraverseLink': '看看我们的姊妹形状编辑站点 Polyhedraverse &rarr;',
  'welcome.aboutTitle': '关于 Rhombiverse',
  'welcome.overview': '风景视图：由填满空间的形状构成的晶格，涵盖 2D、3D 和 4D。',
  'welcome.howTo': '使用指南 &rarr;',
};

const ru = {
  'hud.menu': 'Меню',
  'hud.settings': 'Настройки',
  'lab.close': 'Закрыть',
  'lab.rhombisLinkHint': 'Вы здесь впервые или просто хотите быструю головоломку? В любое время <a href="./rhombis.html">попробуйте RHOMBIS</a>.',
  'setting.sensitivity': 'Чувствительность обзора',
  'setting.invertY': 'Инвертировать ось Y',
  'setting.fov': 'Угол обзора',
  'setting.quality': 'Качество графики',
  'setting.quality.low': 'Низкое',
  'setting.quality.medium': 'Среднее',
  'setting.quality.high': 'Высокое',
  'setting.fpsMeter': 'Показывать счётчик FPS',
  'setting.volume': 'Громкость',
  'setting.language': 'Язык',
  'color.label': 'Цвет:',
  'color.autoAssign': 'Автоматически назначать цвет по типу детали',
  'piece.label': 'Деталь:',
  'piece.tryHint': 'Попробуйте разместить 6 пирамид на кубе. Затем 12. Затем уберите внешние 6.',
  'world.view': 'Вид мира:',
  'world.view.color': 'Цвет',
  'world.view.translucent': 'Полупрозрачный',
  'world.view.skeleton': 'Каркас',
  'world.sectionView': 'Вид в разрезе',
  'world.flip': 'Отразить',
  'world.rightClickHint': 'Правый клик всегда удаляет выбранную ячейку, в любом режиме.',
  'world.new': 'Новый мир',
  'world.exportJson': 'Экспортировать мир',
  'world.import': 'Импортировать мир',
  'shells.undoTitle': 'Клик: отменить один шаг. Удержание: прокрутка по любому прошлому состоянию.',
  'welcome.rhombisLink': 'Вы здесь впервые? Попробуйте RHOMBIS, нашу вводную 3D-головоломку &rarr;',
  'welcome.polyhedraverseLink': 'Загляните в Polyhedraverse, наш родственный сайт редактирования форм &rarr;',
  'welcome.aboutTitle': 'О Rhombiverse',
  'welcome.overview': 'Пейзажный вид: решётки из фигур, заполняющих пространство, в 2D, 3D и 4D.',
  'welcome.howTo': 'Как пользоваться &rarr;',
};

const I18N = { en, ja, es, fr, ko, zh, ru };

/**
 * Looks up `key` in the given language's dictionary, falling back to
 * English, then the raw key -- same fallback chain as Polyhedraverse's
 * own t(). `vars` does simple `{name}` substitution; HTML-bearing
 * values (e.g. lab.rhombisLinkHint) are meant to be assigned via
 * innerHTML at the call site, matching how this codebase already
 * builds its own dynamic markup (see welcome.js's overlayHtml()).
 */
export function t(key, lang, vars) {
  let s = I18N[lang]?.[key] ?? I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export { I18N as __I18N_FOR_VERIFY_ONLY__ };
