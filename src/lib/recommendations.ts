import type {
  CompetitorEntry,
  GeoReadiness,
  QuestionResult,
  Recommendation,
  VisibilitySplit,
} from "./types";

/**
 * Turn the raw findings into a prioritised, specific action list. Rule-based:
 * each rule that fires adds a recommendation; the list is sorted by priority and
 * the UI shows the top few. Priorities: lower number = do first.
 */
export function generateRecommendations(args: {
  geo: GeoReadiness | null;
  questions: QuestionResult[];
  competitors: CompetitorEntry[];
  visibility: VisibilitySplit;
}): Recommendation[] {
  const { geo, questions, competitors, visibility } = args;
  const recs: Recommendation[] = [];
  const has = (id: string) => geo?.signals.find((s) => s.id === id)?.present ?? false;

  // Direct-booking angle: cited via OTAs but not your own site.
  if (visibility.viaOta > 0 && visibility.ownDomain < visibility.viaOta) {
    recs.push({
      priority: 1,
      title: "Win back the citations OTAs are taking",
      detail: `AI is pointing guests to booking sites for ${visibility.viaOta} of your questions, not your own site. Publish the same answers on your domain so AI can cite you directly and you keep the booking.`,
    });
  }

  // Questions with no citation at all.
  const missed = questions.filter((q) => q.status === "done" && !q.citedAny);
  if (missed.length > 0) {
    const examples = missed.slice(0, 3).map((q) => `"${q.question}"`).join(", ");
    recs.push({
      priority: 2,
      title: `Create content for ${missed.length} question${missed.length > 1 ? "s" : ""} you are invisible on`,
      detail: `AI never cited you for ${examples}${missed.length > 3 ? " and more" : ""}. Write a clear, factual page answering each one the way a guest asks it.`,
    });
  }

  if (!has("business-schema")) {
    recs.push({
      priority: 3,
      title: "Add Hotel or LocalBusiness structured data",
      detail:
        "Without schema, AI struggles to identify you as a bookable property. Add Hotel/LocalBusiness JSON-LD with your name, address, price range and amenities.",
    });
  }

  if (!has("faq-schema") || !has("faq-content")) {
    recs.push({
      priority: 4,
      title: "Publish FAQ content that matches how guests ask AI",
      detail:
        "Add a question-and-answer section (with FAQPage schema) covering parking, pets, families, location and nearby attractions. AI lifts these almost verbatim.",
    });
  }

  if (!has("reviews")) {
    recs.push({
      priority: 5,
      title: "Surface your reviews and ratings as structured data",
      detail:
        "AI leans heavily on review signals. Add aggregateRating and Review markup so your rating is machine-readable, not trapped in a widget.",
    });
  }

  // Rival properties dominating.
  const rivals = competitors.filter((c) => c.kind === "rival").slice(0, 3);
  if (rivals.length > 0 && visibility.ownDomain <= visibility.invisible) {
    recs.push({
      priority: 6,
      title: "Close the gap on rival properties AI already favours",
      detail: `${rivals.map((r) => r.domain).join(", ")} are cited ahead of you. Look at how they structure their pages and match their depth on the questions you share.`,
    });
  }

  if (!has("entity-clarity")) {
    recs.push({
      priority: 7,
      title: "Sharpen your title and description",
      detail:
        "State plainly who you are, where you are and what makes you distinct in your page title and meta description so AI can quote it.",
    });
  }

  return recs.sort((a, b) => a.priority - b.priority);
}
