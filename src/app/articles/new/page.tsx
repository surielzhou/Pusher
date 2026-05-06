import GenerationForm from "../../../components/article/GenerationForm.tsx";

export const metadata = {
  title: "生成配置 - Pusher"
};

export default function NewArticlePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        color: "#1f2933",
        display: "grid",
        justifyItems: "center",
        padding: "48px 24px"
      }}
    >
      <GenerationForm />
    </main>
  );
}
