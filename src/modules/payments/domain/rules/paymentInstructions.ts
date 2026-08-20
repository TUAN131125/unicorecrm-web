export function renderPaymentTransferContent(template: string, orderNumber: string): string {
  return template.replaceAll("{orderNumber}", orderNumber).slice(0, 140);
}

function field(id: string, value: string): string {
  if (!value) return "";
  if (value.length > 99) throw new Error(`VietQR field ${id} exceeds 99 characters.`);
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function normalize(value: string): string {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ._\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildLocalVietQrPayload(input: { bankBin: string; accountNumber: string; amount?: number; transferContent: string }): string {
  const bankBin = input.bankBin.replace(/\D/g, "");
  const accountNumber = input.accountNumber.replace(/\s+/g, "");
  if (!bankBin || !accountNumber) throw new Error("VietQR requires a bank BIN and receiving account number.");
  const amount = typeof input.amount === "number" && input.amount > 0 ? String(Math.round(input.amount)) : "";
  const consumerAccount = field("00", bankBin) + field("01", accountNumber);
  const merchantAccount = field("00", "A000000727") + field("01", consumerAccount) + field("02", "QRIBFTTA");
  const additionalData = normalize(input.transferContent);
  const body = field("00", "01")
    + field("01", amount ? "12" : "11")
    + field("38", merchantAccount)
    + field("52", "0000")
    + field("53", "704")
    + (amount ? field("54", amount) : "")
    + field("58", "VN")
    + (additionalData ? field("62", field("08", additionalData)) : "")
    + "6304";
  return body + crc16(body);
}
