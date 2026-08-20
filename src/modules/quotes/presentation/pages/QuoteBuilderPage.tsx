import React from "react";
import { useQuoteBuilderController, type QuoteBuilderPageProps } from "../hooks/useQuoteBuilderController";
import { QuoteBuilderView } from "../views/QuoteBuilderView";

export const QuoteBuilderPage: React.FC<QuoteBuilderPageProps> = (props) => {
  const controller = useQuoteBuilderController(props);
  return <QuoteBuilderView controller={controller} />;
};
