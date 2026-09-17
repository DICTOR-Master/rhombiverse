// UI-chrome i18n for RHOMBIS, the standalone puzzle entry point --
// same 7-language set and scoping discipline as the main app
// (src/app/i18n.js) and Polyhedraverse's own app/lib/i18n.ts: covers
// ONLY this app's own interface strings, never stage/piece names.
// Imports LANG_ORDER/LANG_META from the main app's module (a small,
// dependency-free constant, safe to share) rather than duplicating that
// list -- but keeps its OWN dictionaries here, since RHOMBIS's actual
// UI text is almost entirely different from the main app's.
import { LANG_ORDER, LANG_META } from '../app/i18n.js';

export { LANG_ORDER, LANG_META };

const en = {
  'topbar.subtitle': '3D puzzle from Rhombiverse',
  'topbar.stages': 'Stages',
  'topbar.backToRhombiverse': '← Rhombiverse',
  'topbar.language': 'Language',
  'undo.button': 'Undo',
  'solved.hud': 'Solved!',
  'solved.bannerMore': 'Solved! More stages coming soon.',
  'solved.bannerFinal': 'Solved!',
  'picker.title': 'Choose a Stage',
  'picker.close': 'Close',
  'stage.label': 'Stage {id}: {name}',
  'stage.derivedFrom': 'derived from {list}',
  'hud.leftSuffix': ' ({n} left)',
  'hud.tapVoidFlip': 'Tap a piece, then tap its void (tap again to flip){suffix}',
  'hud.tapVoidPlace': 'Tap a piece, then tap a void to place it{suffix}',
  'hud.tapSkeletonPlace': 'Tap the piece, then tap the skeleton to place it',
  'hud.selectedFlipOrPlace': 'Piece selected ({label}) -- tap it again to flip, or tap a void to place{suffix}',
  'hud.selectedFused': 'Fused piece selected -- tap anywhere on that region to fill it all at once',
  'hud.selectedPlace': 'Piece selected{suffix} -- tap a void to place it',
  'hud.selectedPlaceSkeleton': 'Piece selected -- tap the skeleton to place it',
  'orientation.apexUp': 'apex up',
  'orientation.apexDown': 'apex down',
  'orientation.faceDirection': '{axis} face, {direction}',
  'orientation.inward': 'inward',
  'orientation.outward': 'outward',
};

const ja = {
  'topbar.subtitle': 'Rhombiverse発の3Dパズル',
  'topbar.stages': 'ステージ',
  'topbar.backToRhombiverse': '← Rhombiverse',
  'topbar.language': '言語',
  'undo.button': '元に戻す',
  'solved.hud': 'クリア！',
  'solved.bannerMore': 'クリア！次のステージも近日公開。',
  'solved.bannerFinal': 'クリア！',
  'picker.title': 'ステージを選択',
  'picker.close': '閉じる',
  'stage.label': 'ステージ {id}: {name}',
  'stage.derivedFrom': '派生元: {list}',
  'hud.leftSuffix': '（残り{n}個）',
  'hud.tapVoidFlip': 'ピースをタップし、次にその空間をタップ（再タップで反転）{suffix}',
  'hud.tapVoidPlace': 'ピースをタップし、次に空間をタップして配置{suffix}',
  'hud.tapSkeletonPlace': 'ピースをタップし、次に骨組みをタップして配置',
  'hud.selectedFlipOrPlace': 'ピース選択中（{label}）-- 再タップで反転、空間をタップで配置{suffix}',
  'hud.selectedFused': '結合ピース選択中 -- その領域のどこかをタップすると一括で埋まります',
  'hud.selectedPlace': 'ピース選択中{suffix} -- 空間をタップして配置',
  'hud.selectedPlaceSkeleton': 'ピース選択中 -- 骨組みをタップして配置',
  'orientation.apexUp': '頂点が上',
  'orientation.apexDown': '頂点が下',
  'orientation.faceDirection': '{axis}面、{direction}',
  'orientation.inward': '内向き',
  'orientation.outward': '外向き',
};

const es = {
  'topbar.subtitle': 'Rompecabezas 3D de Rhombiverse',
  'topbar.stages': 'Etapas',
  'topbar.backToRhombiverse': '← Rhombiverse',
  'topbar.language': 'Idioma',
  'undo.button': 'Deshacer',
  'solved.hud': '¡Resuelto!',
  'solved.bannerMore': '¡Resuelto! Más etapas próximamente.',
  'solved.bannerFinal': '¡Resuelto!',
  'picker.title': 'Elige una Etapa',
  'picker.close': 'Cerrar',
  'stage.label': 'Etapa {id}: {name}',
  'stage.derivedFrom': 'derivado de {list}',
  'hud.leftSuffix': ' (quedan {n})',
  'hud.tapVoidFlip': 'Toca una pieza y luego su hueco (toca de nuevo para voltear){suffix}',
  'hud.tapVoidPlace': 'Toca una pieza y luego un hueco para colocarla{suffix}',
  'hud.tapSkeletonPlace': 'Toca la pieza y luego el esqueleto para colocarla',
  'hud.selectedFlipOrPlace': 'Pieza seleccionada ({label}) -- tócala de nuevo para voltearla, o toca un hueco para colocarla{suffix}',
  'hud.selectedFused': 'Pieza fusionada seleccionada -- toca en cualquier punto de esa región para rellenarla toda a la vez',
  'hud.selectedPlace': 'Pieza seleccionada{suffix} -- toca un hueco para colocarla',
  'hud.selectedPlaceSkeleton': 'Pieza seleccionada -- toca el esqueleto para colocarla',
  'orientation.apexUp': 'vértice hacia arriba',
  'orientation.apexDown': 'vértice hacia abajo',
  'orientation.faceDirection': 'cara {axis}, hacia {direction}',
  'orientation.inward': 'adentro',
  'orientation.outward': 'afuera',
};

const fr = {
  'topbar.subtitle': 'Puzzle 3D de Rhombiverse',
  'topbar.stages': 'Étapes',
  'topbar.backToRhombiverse': '← Rhombiverse',
  'topbar.language': 'Langue',
  'undo.button': 'Annuler',
  'solved.hud': 'Résolu !',
  'solved.bannerMore': 'Résolu ! D\'autres étapes arrivent bientôt.',
  'solved.bannerFinal': 'Résolu !',
  'picker.title': 'Choisir une Étape',
  'picker.close': 'Fermer',
  'stage.label': 'Étape {id} : {name}',
  'stage.derivedFrom': 'dérivé de {list}',
  'hud.leftSuffix': ' ({n} restant(s))',
  'hud.tapVoidFlip': 'Touchez une pièce, puis son vide (touchez à nouveau pour la retourner){suffix}',
  'hud.tapVoidPlace': 'Touchez une pièce, puis un vide pour la placer{suffix}',
  'hud.tapSkeletonPlace': 'Touchez la pièce, puis le squelette pour la placer',
  'hud.selectedFlipOrPlace': 'Pièce sélectionnée ({label}) -- touchez-la à nouveau pour la retourner, ou un vide pour la placer{suffix}',
  'hud.selectedFused': 'Pièce fusionnée sélectionnée -- touchez n\'importe où dans cette zone pour la remplir entièrement',
  'hud.selectedPlace': 'Pièce sélectionnée{suffix} -- touchez un vide pour la placer',
  'hud.selectedPlaceSkeleton': 'Pièce sélectionnée -- touchez le squelette pour la placer',
  'orientation.apexUp': 'sommet vers le haut',
  'orientation.apexDown': 'sommet vers le bas',
  'orientation.faceDirection': 'face {axis}, vers {direction}',
  'orientation.inward': 'l\'intérieur',
  'orientation.outward': 'l\'extérieur',
};

const ko = {
  'topbar.subtitle': 'Rhombiverse의 3D 퍼즐',
  'topbar.stages': '스테이지',
  'topbar.backToRhombiverse': '← Rhombiverse',
  'topbar.language': '언어',
  'undo.button': '실행 취소',
  'solved.hud': '완료!',
  'solved.bannerMore': '완료! 더 많은 스테이지가 곧 추가됩니다.',
  'solved.bannerFinal': '완료!',
  'picker.title': '스테이지 선택',
  'picker.close': '닫기',
  'stage.label': '스테이지 {id}: {name}',
  'stage.derivedFrom': '파생 출처: {list}',
  'hud.leftSuffix': ' ({n}개 남음)',
  'hud.tapVoidFlip': '조각을 탭한 다음 빈 공간을 탭하세요 (다시 탭하면 뒤집기){suffix}',
  'hud.tapVoidPlace': '조각을 탭한 다음 빈 공간을 탭해 배치하세요{suffix}',
  'hud.tapSkeletonPlace': '조각을 탭한 다음 뼈대를 탭해 배치하세요',
  'hud.selectedFlipOrPlace': '조각 선택됨 ({label}) -- 다시 탭하면 뒤집기, 빈 공간을 탭하면 배치{suffix}',
  'hud.selectedFused': '결합된 조각 선택됨 -- 해당 영역 아무 곳이나 탭하면 한 번에 채워집니다',
  'hud.selectedPlace': '조각 선택됨{suffix} -- 빈 공간을 탭해 배치하세요',
  'hud.selectedPlaceSkeleton': '조각 선택됨 -- 뼈대를 탭해 배치하세요',
  'orientation.apexUp': '꼭짓점 위쪽',
  'orientation.apexDown': '꼭짓점 아래쪽',
  'orientation.faceDirection': '{axis}면, {direction}',
  'orientation.inward': '안쪽',
  'orientation.outward': '바깥쪽',
};

const zh = {
  'topbar.subtitle': '来自 Rhombiverse 的3D解谜游戏',
  'topbar.stages': '关卡',
  'topbar.backToRhombiverse': '← Rhombiverse',
  'topbar.language': '语言',
  'undo.button': '撤销',
  'solved.hud': '已完成！',
  'solved.bannerMore': '已完成！更多关卡即将推出。',
  'solved.bannerFinal': '已完成！',
  'picker.title': '选择关卡',
  'picker.close': '关闭',
  'stage.label': '第 {id} 关：{name}',
  'stage.derivedFrom': '衍生自 {list}',
  'hud.leftSuffix': '（还剩 {n} 个）',
  'hud.tapVoidFlip': '点击一个部件，然后点击它的空位（再次点击可翻转）{suffix}',
  'hud.tapVoidPlace': '点击一个部件，然后点击空位放置{suffix}',
  'hud.tapSkeletonPlace': '点击部件，然后点击骨架以放置',
  'hud.selectedFlipOrPlace': '已选择部件（{label}）-- 再次点击可翻转，或点击空位放置{suffix}',
  'hud.selectedFused': '已选择组合部件 -- 点击该区域任意位置即可一次性填满',
  'hud.selectedPlace': '已选择部件{suffix} -- 点击空位放置',
  'hud.selectedPlaceSkeleton': '已选择部件 -- 点击骨架以放置',
  'orientation.apexUp': '尖端朝上',
  'orientation.apexDown': '尖端朝下',
  'orientation.faceDirection': '{axis}面，朝{direction}',
  'orientation.inward': '内',
  'orientation.outward': '外',
};

const ru = {
  'topbar.subtitle': '3D-головоломка от Rhombiverse',
  'topbar.stages': 'Этапы',
  'topbar.backToRhombiverse': '← Rhombiverse',
  'topbar.language': 'Язык',
  'undo.button': 'Отменить',
  'solved.hud': 'Решено!',
  'solved.bannerMore': 'Решено! Больше этапов уже скоро.',
  'solved.bannerFinal': 'Решено!',
  'picker.title': 'Выберите этап',
  'picker.close': 'Закрыть',
  'stage.label': 'Этап {id}: {name}',
  'stage.derivedFrom': 'основано на {list}',
  'hud.leftSuffix': ' (осталось: {n})',
  'hud.tapVoidFlip': 'Коснитесь детали, затем её пустоты (коснитесь снова, чтобы перевернуть){suffix}',
  'hud.tapVoidPlace': 'Коснитесь детали, затем пустоты, чтобы разместить её{suffix}',
  'hud.tapSkeletonPlace': 'Коснитесь детали, затем каркаса, чтобы разместить её',
  'hud.selectedFlipOrPlace': 'Деталь выбрана ({label}) -- коснитесь снова, чтобы перевернуть, или пустоты, чтобы разместить{suffix}',
  'hud.selectedFused': 'Выбрана составная деталь -- коснитесь любой точки этой области, чтобы заполнить её целиком',
  'hud.selectedPlace': 'Деталь выбрана{suffix} -- коснитесь пустоты, чтобы разместить её',
  'hud.selectedPlaceSkeleton': 'Деталь выбрана -- коснитесь каркаса, чтобы разместить её',
  'orientation.apexUp': 'вершиной вверх',
  'orientation.apexDown': 'вершиной вниз',
  'orientation.faceDirection': 'грань {axis}, {direction}',
  'orientation.inward': 'внутрь',
  'orientation.outward': 'наружу',
};

const I18N = { en, ja, es, fr, ko, zh, ru };

export function t(key, lang, vars) {
  let s = I18N[lang]?.[key] ?? I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export { I18N as __I18N_FOR_VERIFY_ONLY__ };
