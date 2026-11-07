import { Link } from "wouter";
import { getProcessScenario } from "@shared/processScenarios";
import { tr, useProductLanguage } from "../lib/productLanguage";
import { trpc } from "../lib/trpc";
import StudioApp from "../components/judgment-studio/StudioApp";

export default function JudgmentStudio({ processId }: { processId: string }) {
  const [language] = useProductLanguage();
  const { data: user } = trpc.auth.me.useQuery(undefined, { retry: false });
  const scenario = getProcessScenario(processId);
  if (!scenario) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1>
          {tr(
            language,
            "이 공정 연습을 찾을 수 없어요.",
            "This process exercise could not be found.",
            "この工程の練習が見つかりません。"
          )}
        </h1>
        <Link href="/training">
          {tr(
            language,
            "연습 선택으로",
            "Back to practice selection",
            "練習の選択へ"
          )}
        </Link>
      </main>
    );
  }
  return user ? (
    <StudioApp
      key={user.id}
      processId={scenario.processId}
      language={language}
      userId={user.id}
    />
  ) : null;
}
