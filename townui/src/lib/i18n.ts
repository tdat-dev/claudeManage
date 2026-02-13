export type AppLanguage = "en" | "vi";

type Dict = Record<string, string>;

const en: Dict = {
  language: "Language",
  language_help: "Choose display language for guidance text",
  hook_inbox: "Hook Inbox",
  handoff_center: "Handoff Center",
  terms_title: "Hook / Sling / Handoff quick guide",
  terms_hook: "Hook: a persistent actor lane that can keep context.",
  terms_sling: "Sling: assign + start work immediately on a hook.",
  terms_handoff: "Handoff: transfer work context from one actor to another.",
  terms_done: "Done: close work on hook and write outcome back to task.",
  sling: "Sling",
  new_handoff: "New Handoff",
  worker_quick_actions: "Worker Quick Actions",
  worker_mark_done: "Mark Hook Done",
  worker_create_handoff: "Create Handoff",
};

const vi: Dict = {
  language: "Ngôn ngữ",
  language_help: "Chọn ngôn ngữ hiển thị cho phần hướng dẫn",
  hook_inbox: "Hộp Hook",
  handoff_center: "Trung tâm Handoff",
  terms_title: "Giải thích nhanh Hook / Sling / Handoff",
  terms_hook: "Hook: là một lane actor bền vững để giữ ngữ cảnh làm việc.",
  terms_sling: "Sling: vừa gán việc vừa chạy ngay trên hook.",
  terms_handoff:
    "Handoff: chuyển giao ngữ cảnh công việc từ actor này sang actor khác.",
  terms_done: "Done: kết thúc việc trên hook và ghi kết quả về task.",
  sling: "Sling",
  new_handoff: "Tạo Handoff",
  worker_quick_actions: "Tác vụ nhanh Worker",
  worker_mark_done: "Đánh dấu Hook Done",
  worker_create_handoff: "Tạo Handoff",
};

export const dictionaries: Record<AppLanguage, Dict> = { en, vi };

export function t(language: AppLanguage, key: string): string {
  return dictionaries[language][key] ?? key;
}
