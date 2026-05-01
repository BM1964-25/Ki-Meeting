import { RiskLevel } from "@/types/ai";

const riskClass: Record<RiskLevel, string> = {
  Grün: "risk-badge risk-badge--green",
  Gelb: "risk-badge risk-badge--yellow",
  Rot: "risk-badge risk-badge--red"
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={riskClass[level]}>{level}</span>;
}
