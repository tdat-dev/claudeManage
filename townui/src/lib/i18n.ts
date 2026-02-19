export type AppLanguage = "en" | "vi";

type Dict = Record<string, string>;

const en: Dict = {
  language: "Language",
  language_help: "Choose display language for guidance text",
  hook_inbox: "Hook Inbox",
  handoff_center: "Handoff Center",
  terms_title: "How task assignment works",
  terms_hook:
    "Hook — think of it as an agent's personal to-do slot. It remembers what the agent was working on, even after a restart.",
  terms_sling:
    "Sling — drop a task into an agent's slot and start it right away. One click = assign + go.",
  terms_handoff:
    "Handoff — when one agent gets stuck or finishes their part, they pass the task (with notes) to another agent to continue.",
  terms_done:
    "Done — the agent marks the task as finished and writes down what it accomplished.",
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
  terms_title: "Cách giao việc hoạt động",
  terms_hook:
    "Hook — coi như ô việc riêng của mỗi agent. Nó nhớ agent đang làm gì, kể cả khi tắt mở lại app.",
  terms_sling:
    "Sling — ném việc vào ô của agent rồi chạy luôn. Một click = giao + bắt đầu.",
  terms_handoff:
    "Handoff — khi agent bị kẹt hoặc làm xong phần mình, nó chuyển việc (kèm ghi chú) cho agent khác làm tiếp.",
  terms_done: "Done — agent đánh dấu xong việc và ghi lại kết quả.",
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
