import { useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { ArrowRightLeft, Search } from "lucide-react";
import { useDeals, type DealRow } from "../deals/hooks";
import { DealForm } from "../deals/DealForm";
import { AddButton } from "../shared/AddButton";
import { money } from "../shared/format";
import { LoadError, Loading } from "../shared/Loading";
import { PageHeader } from "../shared/PageHeader";
import { usePhoneShape } from "../shared/phone";
import { SidePanel } from "../shared/SidePanel";
import { STAGES, stageFromParam, stageInfo, type Stage } from "../shared/stages";
import { useToast } from "../shared/Toast";
import { TopBarSlot } from "../shared/topBarSlot";
import { boardTotals, buildColumns, matches, moveToStage, moveWithin, totals } from "./board";
import { ColumnFrame } from "./Column";
import { DealCard } from "./DealCard";
import { useSendMove } from "./hooks";
import { MoveSheet } from "./MoveSheet";
import { StageTabs } from "./StageTabs";
import "./pipeline-phone.css";

const PANEL = "stage-panel";

/** The open totals under the page title (P9). */
function boardSummary(deals: DealRow[]) {
  const board = boardTotals(deals);
  return (
    <span aria-label="Open pipeline totals">
      <span data-testid="board-value">{money(board.value)}</span> open · exp.{" "}
      <span data-testid="board-expected">{money(board.expected)}</span>
    </span>
  );
}

/**
 * P9 to P11: the board on a phone, one stage at a time. The stage is kept in the address, cards
 * have no drag, and Move to moves them through the same save path as a drop.
 */
export function PhonePipeline() {
  const query = useDeals();
  const { saving, send } = useSendMove();
  const toast = useToast();
  const slot = useContext(TopBarSlot);
  const landscape = usePhoneShape() === "landscape";
  const [params, setParams] = useSearchParams();
  const stage = stageFromParam(params.get("stage")) ?? "new";
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<Stage | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const closeAdd = useCallback(() => setAdding(null), []);
  const closeMove = useCallback(() => setMoving(null), []);

  const deals = useMemo(() => query.data?.items ?? [], [query.data]);
  const byId = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const visible = useMemo(() => deals.filter((d) => matches(d, search)), [deals, search]);
  const columns = useMemo(() => buildColumns(visible), [visible]);
  const cards = columns[stage].map((id) => byId.get(id)).filter(Boolean) as DealRow[];
  const counts = Object.fromEntries(STAGES.map((s) => [s.key, columns[s.key].length])) as Record<
    Stage,
    number
  >;
  const stageTotals = totals(search ? cards : deals.filter((d) => d.stage === stage));
  const deal = moving === null ? undefined : byId.get(moving);
  const place = deal ? columns[deal.stage].indexOf(deal.id) : -1;

  const choose = (next: Stage) => setParams({ stage: next }, { replace: true });
  const toStage = (id: number, next: Stage) => {
    const name = byId.get(id)?.name;
    // P11: the message says where the card went once it's saved; a failure says why instead.
    void send(deals, moveToStage(deals, id, next))?.then(
      (saved) => saved && toast.success(`Moved ${name} to ${stageInfo(next).label}`),
    );
  };

  const within = (id: number, step: -1 | 1) => () =>
    void send(deals, moveWithin(deals, visible, id, step));

  const stageBar = (
    <div className="stage-bar">
      <StageTabs chosen={stage} counts={counts} onChoose={choose} panel={PANEL} />
      <div className="stage-sum" aria-label={`${stageInfo(stage).label} totals`}>
        <span data-testid="column-value">{money(stageTotals.value)}</span>
        <span data-testid="column-expected">exp. {money(stageTotals.expected)}</span>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Pipeline"
        summary={query.data ? boardSummary(deals) : " "}
        action={<AddButton noun="deal" onClick={() => setAdding(stage)} />}
      />
      {/* In landscape the tabs and the stage's totals share the top bar's row (P9). */}
      {landscape && slot ? createPortal(stageBar, slot) : stageBar}
      <label className="search-box board-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search deals</span>
        <input
          type="search"
          placeholder="Search deals"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <LoadError error={query.error} what="pipeline" />
      ) : (
        <div
          className="phone-board"
          role="tabpanel"
          id={PANEL}
          aria-labelledby={`stage-tab-${stage}`}
        >
          <ColumnFrame
            stage={stageInfo(stage)}
            totals={stageTotals}
            head={false}
            empty={cards.length === 0}
            onAdd={() => setAdding(stage)}
          >
            {cards.map((card) => (
              <DealCard
                key={card.id}
                deal={card}
                link={`/deals/${card.id}`}
                className={saving.has(card.id) ? "phone-card saving" : "phone-card"}
                action={
                  <button
                    type="button"
                    className="move-btn"
                    aria-haspopup="dialog"
                    aria-label={`Move to: ${card.name}`}
                    onClick={() => setMoving(card.id)}
                  >
                    <ArrowRightLeft size={14} aria-hidden="true" />
                    Move to
                  </button>
                }
              />
            ))}
          </ColumnFrame>
        </div>
      )}
      {deal && (
        <MoveSheet
          deal={deal}
          open
          onClose={closeMove}
          onStage={(next) => toStage(deal.id, next)}
          onUp={place > 0 ? within(deal.id, -1) : undefined}
          onDown={
            place !== -1 && place < columns[deal.stage].length - 1 ? within(deal.id, 1) : undefined
          }
        />
      )}
      <SidePanel title="Add deal" open={adding !== null} onClose={closeAdd}>
        {adding !== null && (
          <DealForm preset={{ stage: adding }} onSaved={closeAdd} onCancel={closeAdd} />
        )}
      </SidePanel>
    </>
  );
}
