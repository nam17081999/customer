function removeVietnameseTones(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

// Chuẩn hoá thêm các cụm phụ âm phát âm giống nhau để hỗ trợ tìm kiếm linh hoạt
// Ví dụ: s/x, ch/tr, ng/ngh, d/gi/r, l/n
function normalizeVietnamesePhonetics(str) {
  const base = removeVietnameseTones(str || "");
  const words = base.split(/\s+/).filter(Boolean);

  const normalizeWord = (word) => {
    // Ưu tiên thay thế các cụm dài trước để tránh đè lên nhau
    let w = word;
    w = w.replace(/^ngh/, "ng");
    w = w.replace(/^tr/, "ch");
    w = w.replace(/^gi/, "d");
    w = w.replace(/^r/, "d");
    w = w.replace(/^x/, "s");
    w = w.replace(/^n(?!g|h)/, "l");
    // Giữ nguyên các trường hợp đã vào nhóm để hạn chế biến đổi quá mức
    return w;
  };

  return words.map(normalizeWord).join(" ");
}

export default removeVietnameseTones;
export { normalizeVietnamesePhonetics };
