import type { Deal } from "@/modules/deals";
import type { Quote } from "@/modules/quotes";
import type { SupportCase } from "@/modules/support";

export function draftFollowUpEmail(
  entity: any,
  type: "lead" | "customer",
): string {
  const name = entity?.name || entity?.displayName || "Quý khách hàng";
  const contactName = entity?.representativeName || "Anh/Chị";
  return `Chào ${contactName},\n\nTôi là đại diện từ Unicore CRM. Tôi viết email này để theo dõi tiến độ thảo luận liên quan đến giải pháp quản trị của chúng tôi.\n\nNếu anh/chị có bất kỳ câu hỏi nào về tính năng sản phẩm hoặc báo giá đề xuất, xin vui lòng phản hồi email này để đặt lịch hẹn thảo luận sâu hơn.\n\nTrân trọng,\nĐội ngũ kinh doanh Unicore`;
}

export function draftSupportReply(
  caseItem: SupportCase,
  contactName: string = "Anh/Chị",
): string {
  const code = caseItem.caseNumber || `#CS-${caseItem.id.substring(0, 4)}`;
  const title = caseItem.title || "yêu cầu chăm sóc";
  return `Chào ${contactName},\n\nChúng tôi đã nhận được nội dung liên quan đến Phiếu hỗ trợ ${code}: "${title}".\n\nNgười phụ trách đang theo dõi và sẽ cập nhật bước xử lý tiếp theo theo lịch đã thống nhất với Anh/Chị.\n\nTrân trọng,\nBộ phận Chăm sóc khách hàng Unicore CRM`;
}

export function draftQuoteReminder(quote: Quote): string {
  const code = quote.quoteNumber || `#Q-${quote.id.substring(0, 4)}`;
  const total = (quote.grandTotal || 0).toLocaleString("vi-VN") || "0";
  return `Kính gửi Anh/Chị,\n\nUnicore CRM xin phép nhắc lịch hiệu lực của báo giá ${code} trị giá ${total} ₫ dự kiến hết hạn vào ngày ${new Date(quote.validUntil || Date.now() + 86400000 * 7).toLocaleDateString("vi-VN")}.\n\nHy vọng chúng tôi sớm nhận được phản hồi duyệt từ phía anh/chị để chuyển giao dự án sang giai đoạn chuẩn bị đơn hàng.\n\nTrân trọng,\nPhòng Kinh doanh Unicore`;
}

export function draftDealNextStep(deal: Deal): string {
  const name = deal.name || "Cơ hội mới";
  return `Chào Anh/Chị,\n\nTôi gửi thông tin cập nhật lộ trình triển khai cơ hội hợp tác "${name}". Chúng tôi đã thiết kế chi tiết phương án và sẵn sàng chuẩn bị báo giá chính thức trong tuần tới.\n\nVui lòng sắp xếp thời gian trao đổi ngắn để chúng tôi làm rõ các điều khoản thương mại.\n\nTrân trọng,\nChuyên viên Kinh doanh Unicore`;
}

