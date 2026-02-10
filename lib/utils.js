import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Convert first letter of each word to uppercase, preserving Vietnamese characters
export function toTitleCaseVI(str) {
  if (!str) return "";
  // Lowercase first to normalize, then uppercase the first letter of each word
  const lower = str.toLowerCase();
  return lower.replace(/(^|[\s\-_/.,;:()\[\]{}!?'"+&])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
}

export function formatAddressParts(store) {
  if (!store) return '';
  const parts = [];
  if (store.address_detail) parts.push(store.address_detail);
  if (store.ward) parts.push(store.ward);
  if (store.district) parts.push(store.district);
  if (parts.length > 0) return parts.join(', ');
  return '';
}
