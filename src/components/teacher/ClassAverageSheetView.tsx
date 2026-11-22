import React from 'react';
import { TermGeneralAverageView } from './TermGeneralAverageView';
import { AnnualGeneralAverageView } from './AnnualGeneralAverageView';
import type {
  ClassAverageCardItem,
  ClassItem,
  SchoolItem,
  SchoolYearItem,
  SubjectItem,
  TermItem,
} from './TeacherClassesView';

export interface ClassAverageSheetViewProps {
  averageCard: ClassAverageCardItem;
  schoolClass: ClassItem;
  schoolYear?: SchoolYearItem | null;
  school?: SchoolItem | null;
  term?: TermItem | null;
  userId?: string;
  initialSubjects?: SubjectItem[];
  initialTerms?: TermItem[];
  onOpenSubject?: (subjectId: string) => void;
  onSubjectCoefficientUpdated?: (subjectId: string, coefficient: number | null) => void;
  onOpenTermAverageCard?: (termId: string) => void;
  onTermCoefficientUpdated?: (termId: string, coefficient: number | null) => void;
  onBack: () => void;
}

/**
 * Point d'entrée des tableaux de Moyenne Générale d'une classe :
 * - Pour un trimestre (`kind === 'term'`) : ouvre le tableau dédié connecté à la base
 *   avec toutes les matières du trimestre (Moy. /20 + Moy. × Coeff), Total Général, Moyenne Générale,
 *   Mention, Rang et Moyenne de la classe.
 * - Pour la Moyenne générale de l'année (`kind === 'annual'`) : ouvre le tableau annuel dédié
 *   connecté à la base avec tous les trimestres de la classe (Moy. /20 + Moy. × Coeff),
 *   Total Annuel, Moyenne Annuelle, Mention, Rang annuel et Moyenne de la classe.
 */
export const ClassAverageSheetView: React.FC<ClassAverageSheetViewProps> = ({
  averageCard,
  schoolClass,
  schoolYear,
  school,
  term,
  userId,
  initialSubjects = [],
  initialTerms = [],
  onOpenSubject,
  onSubjectCoefficientUpdated,
  onOpenTermAverageCard,
  onTermCoefficientUpdated,
  onBack,
}) => {
  if (averageCard.kind === 'term') {
    return (
      <TermGeneralAverageView
        key={averageCard.id}
        averageCard={averageCard}
        schoolClass={schoolClass}
        schoolYear={schoolYear}
        school={school}
        term={term || null}
        userId={userId}
        initialSubjects={initialSubjects}
        onOpenSubject={onOpenSubject}
        onSubjectCoefficientUpdated={onSubjectCoefficientUpdated}
        onBack={onBack}
      />
    );
  }

  return (
    <AnnualGeneralAverageView
      key={averageCard.id}
      averageCard={averageCard}
      schoolClass={schoolClass}
      schoolYear={schoolYear}
      school={school}
      userId={userId}
      initialTerms={initialTerms}
      onOpenTermAverageCard={onOpenTermAverageCard}
      onTermCoefficientUpdated={onTermCoefficientUpdated}
      onBack={onBack}
    />
  );
};
