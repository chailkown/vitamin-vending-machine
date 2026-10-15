// Retain nutrient definitions and historical product IDs. Re-enable only with catalog review.
export const DISABLED_CATEGORIES = ['밀크시슬', '비타민 E'];
export const isProductEnabled = (product) => product?.is_active !== false
  && !DISABLED_CATEGORIES.includes(product?.category || product?.nutrients?.name);
