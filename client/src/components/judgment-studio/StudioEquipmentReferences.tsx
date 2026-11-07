import type { ProcessId } from "@shared/processScenarios";
import { tr, type ProductLanguage } from "../../lib/productLanguage";
import { studioContent } from "./studio-content";
import { local, translate } from "./studio-i18n";
import "./studio-equipment-references.css";

export default function StudioEquipmentReferences({
  processId,
  language,
}: {
  processId: ProcessId;
  language: ProductLanguage;
}) {
  const equipment = studioContent[processId].equipment;
  return (
    <section className="et-panel studio-equipment-references">
      <h2>{translate(language, "equipment")}</h2>
      <p className="et-caption">{translate(language, "equipmentNote")}</p>
      <ul className="studio-equipment-references-grid">
        {equipment.map(({ name, role, question, sourceTitle, url }) => (
          <li key={url} className="studio-equipment-reference">
            <h3>{name}</h3>
            <p>{local(role, language)}</p>
            <div className="studio-equipment-followup">
              <strong>{translate(language, "followup")}</strong>
              <p>{local(question, language)}</p>
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {sourceTitle} ↗ ({tr(language, "새 탭", "new tab", "新しいタブ")})
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
