// How each dimension is named on screen. 1D, 2D and 3D show as 1D+, 2D+ and
// 3D+ (much of each mode interacts with the other dimensions); 4D, 5D and 6D
// keep their names. Ids ('1D' ... '6D') are unchanged everywhere else.
const LABELS = { '1D': '1D+', '2D': '2D+', '3D': '3D+' };
export const dimensionLabel = (id) => LABELS[id] ?? id;
