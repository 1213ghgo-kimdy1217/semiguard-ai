import React, { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import {
  getProcessScenario,
  processScenarios,
  type ProcessId,
} from "../../../shared/processScenarios";
import TrainingHistoryList from "../components/TrainingHistoryList";
import { tr, useProductLanguage } from "../lib/productLanguage";
import { trpc } from "../lib/trpc";
import "./etch-training.css";
import "./practice-history.css";

export function historyProcessFilter(search: string): ProcessId | "all" {
  const requested = new URLSearchParams(search).get("process");
  return (
    processScenarios.find(scenario => scenario.processId === requested)
      ?.processId ?? "all"
  );
}

/** Reads the same saved choice records used by the existing practice home. */
export default function PracticeHistory() {
  const [language] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const search = useSearch();
  const initialProcess = historyProcessFilter(search);
  const [process, setProcess] = useState<ProcessId | "all">(initialProcess);
  const auth = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const authReady = Boolean(auth.data) && !auth.isLoading && !auth.isError;
  const history = trpc.training.history.useQuery(undefined, {
    enabled: authReady,
    retry: false,
  });
  const accountId = auth.data?.id;
  // The history query has a shared key. Recheck on identity change and never render another account's cached rows.
  const ownsHistory =
    accountId !== undefined && history.data?.userId === accountId;
  const attempts =
    ownsHistory && !auth.isLoading && !auth.isError && !history.isError
      ? history.data!.attempts.slice(0, 20)
      : undefined;
  const visible = attempts?.filter(
    attempt =>
      process === "all" ||
      getProcessScenario(attempt.scenarioId)?.processId === process
  );
  useEffect(() => {
    setProcess(initialProcess);
  }, [initialProcess]);
  useEffect(() => {
    if (accountId !== undefined && authReady) void history.refetch();
  }, [accountId, authReady]);
  useEffect(() => {
    document.title = tr(
      language,
      "SemiGuard — 내 학습 기록·복기",
      "SemiGuard — My saved practice and review",
      "SemiGuard — 自分の学習記録・振り返り"
    );
  }, [language]);

  return (
    <div className="et-app ph-app">
      <main className="et-main">
        <div className="ph-breadcrumb">
          <Link href="/training">
            {l(
              "← 판단 연습 선택",
              "← Choose judgment practice",
              "← 判断練習の選択"
            )}
          </Link>
        </div>
        <p className="et-eyebrow">MY PRACTICE / TIMELINE REVIEW</p>
        <h1>
          {l(
            "내 학습 기록·복기",
            "My saved practice and review",
            "自分の学習記録・振り返り"
          )}
        </h1>
        <p className="et-lead">
          {l(
            "제출했던 판단을 다시 열어, 내가 고른 변화 항목·시점과 정상 참고를 비교하세요.",
            "Reopen a submitted judgment to compare your chosen signal and time with the normal reference.",
            "提出した判断を開き、自分が選んだ変化項目・時点を正常参照と比較します。"
          )}
        </p>
        <ol
          className="ph-review-path"
          aria-label={l(
            "판단 연습의 복기 순서",
            "Judgment review steps",
            "判断練習の振り返り手順"
          )}
        >
          <li>
            <span>01</span>
            {l("저장 기록 선택", "Choose a saved record", "保存記録を選ぶ")}
          </li>
          <li>
            <span>02</span>
            {l(
              "내 판단과 참고 비교",
              "Compare judgment and reference",
              "自分の判断と参照を比較"
            )}
          </li>
          <li>
            <span>03</span>
            {l(
              "당시 시점 다시 보기",
              "Revisit the recorded time",
              "当時の時点を振り返る"
            )}
          </li>
        </ol>
        <section
          className="et-panel ph-records"
          aria-label={l(
            "계정에 저장된 판단 연습",
            "Saved judgment practice for this account",
            "アカウントの判断練習記録"
          )}
        >
          {auth.isLoading ? (
            <p role="status">
              {l(
                "로그인 상태를 확인하는 중…",
                "Checking sign-in…",
                "ログイン状態を確認中…"
              )}
            </p>
          ) : auth.isError ? (
            <div role="alert">
              <p>
                {l(
                  "로그인 상태를 확인하지 못했습니다.",
                  "Could not check sign-in status.",
                  "ログイン状態を確認できませんでした。"
                )}
              </p>
              <button
                className="et-linkbutton"
                type="button"
                disabled={auth.isFetching}
                onClick={() => void auth.refetch()}
              >
                {l("다시 확인", "Check again", "再確認")}
              </button>
            </div>
          ) : !auth.data ? (
            <p>
              <Link className="et-linkbutton" href="/login">
                {l(
                  "내 기록을 보려면 로그인하세요",
                  "Sign in to view your records",
                  "自分の記録を見るにはログインしてください"
                )}
              </Link>
            </p>
          ) : history.isError ? (
            <div role="alert">
              <p>
                {l(
                  "학습 기록을 불러오지 못했습니다. 다시 시도해 주세요.",
                  "Could not load saved practice. Please try again.",
                  "学習記録を読み込めませんでした。再試行してください。"
                )}
              </p>
              <button
                className="et-linkbutton"
                type="button"
                disabled={history.isFetching}
                onClick={() => void history.refetch()}
              >
                {l("기록 다시 불러오기", "Reload records", "記録を再読み込み")}
              </button>
            </div>
          ) : history.isLoading || (history.isFetching && !attempts) ? (
            <p role="status">
              {l(
                "현재 계정의 기록을 불러오는 중…",
                "Loading this account's records…",
                "現在のアカウントの記録を読み込み中…"
              )}
            </p>
          ) : !attempts ? (
            <div role="status">
              <p>
                {l(
                  "현재 계정의 기록을 다시 확인해 주세요.",
                  "Please recheck the records for this account.",
                  "現在のアカウントの記録を再確認してください。"
                )}
              </p>
              <button
                className="et-linkbutton"
                type="button"
                onClick={() => void history.refetch()}
              >
                {l("기록 다시 확인", "Recheck records", "記録を再確認")}
              </button>
            </div>
          ) : !attempts.length ? (
            <div className="ph-empty">
              <h2>
                {l(
                  "아직 저장된 판단 기록이 없어요.",
                  "No saved judgments yet.",
                  "保存済みの判断記録はまだありません。"
                )}
              </h2>
              <p>
                {l(
                  "판단 연습에서 관찰하고 제출하면, 이곳에서 선택형 결과와 타임라인을 다시 볼 수 있어요.",
                  "Observe and submit in judgment practice, then revisit your choices and timeline here.",
                  "判断練習で観察・提出すると、選択結果とタイムラインをここで振り返れます。"
                )}
              </p>
              <Link className="et-linkbutton" href="/training">
                {l(
                  "판단 연습 시작하기 →",
                  "Start judgment practice →",
                  "判断練習を始める →"
                )}
              </Link>
            </div>
          ) : (
            <>
              <label className="ph-process-filter">
                {l("복기할 공정", "Process to review", "振り返る工程")}
                <select
                  value={process}
                  onChange={event =>
                    setProcess(
                      historyProcessFilter(
                        `process=${encodeURIComponent(event.target.value)}`
                      )
                    )
                  }
                >
                  <option value="all">
                    {l("전체 공정", "All processes", "すべての工程")}
                  </option>
                  {processScenarios.map(scenario => (
                    <option key={scenario.processId} value={scenario.processId}>
                      {String(scenario.order).padStart(2, "0")} ·{" "}
                      {l(...scenario.title)}
                    </option>
                  ))}
                </select>
              </label>
              {visible?.length ? (
                <TrainingHistoryList
                  key={`${accountId}:${process}`}
                  attempts={visible}
                  language={language}
                />
              ) : (
                <div className="ph-empty">
                  <p>
                    {l(
                      "이 공정의 최근 저장 기록이 없습니다. 다른 공정이나 전체 공정을 선택하세요.",
                      "No recent saved records for this process. Choose another process or All processes.",
                      "この工程の直近の保存記録はありません。別の工程か、すべての工程を選んでください。"
                    )}
                  </p>
                  <button
                    className="et-linkbutton"
                    type="button"
                    onClick={() => setProcess("all")}
                  >
                    {l(
                      "전체 공정 기록 보기",
                      "View all process records",
                      "すべての工程記録を見る"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
        <p className="et-caption">
          {l(
            "계정에 저장된 최근 최대 20건을 보여줍니다. 공정 필터도 이 최근 기록 안에서만 적용됩니다. 제출한 선택형 판단 결과를 다시 보며, 서술형 원문은 복원되지 않습니다.",
            "Shows up to 20 recent saved account records. The process filter applies only within those recent records. Review submitted choices here; original written answers are not restored.",
            "アカウントに保存された直近最大20件を表示します。工程フィルターもこの直近記録内に適用されます。提出した選択結果を振り返り、元の記述回答は復元しません。"
          )}
        </p>
      </main>
    </div>
  );
}
