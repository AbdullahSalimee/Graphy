export function createConversation() {
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    messages: [],
    createdAt: new Date(),
  };
}
