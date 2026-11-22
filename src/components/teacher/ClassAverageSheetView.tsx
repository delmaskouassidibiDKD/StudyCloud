import React, { useMemo } from 'react';
import { SubjectGradebookView } from './SubjectGradebookView';
import { TermGeneralAverageView } from './TermGeneralAverageView';
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
  onOpenSubject?: (subjectId: string) => void;
  onSubjectCoefficientUpdated?: (subjectId: string, coefficient: number | null) => void;
  onBack: () => void;
}

/**
 * Point d'entrée des tableaux de Moyenne Générale d'une classe :
 * - Pour un trimestre (`kind === 'term'`) : ouvre le tableau dédié connecté à la base de données
 *   avec toutes les matières du trimestre (Moy. /20 + Moy. × Coeff), Total Général, Moyenne Générale,
 *   Mention, Rang et Moyenne de la classe.
 * - Pour la Moyenne générale de l'année (`kind === 'annual'`) : conserve le modèle détaché
 *   en attendant l'étape suivante d'adaptation annuelle.
 */
export const ClassAverageSheetView: React.FC<ClassAverageSheetViewProps> = ({
  averageCard,
  schoolClass,
  schoolYear,
  school,
  term,
  userId,
  initialSubjects = [],
  onOpenSubject,
  onSubjectCoefficientUpdated,
  onBack,
}) => {
  const syntheticSubject = useMemo<SubjectItem>(
    () => ({
      id: `preview-avg-${averageCard.id}`,
      classId: schoolClass.id,
      termId: averageCard.termId || 'annual',
      schoolId: averageCard.schoolId,
      yearId: averageCard.yearId,
      name: averageCard.title,
      color: averageCard.color || '#ffffff',
      textColor: averageCard.textColor || '#0f172a',
      borderColor: averageCard.borderColor || '#e2e8f0',
      borderDarkColor: averageCard.borderDarkColor || '#cbd5e1',
      createdAt: averageCard.createdAt,
    }),
    [averageCard, schoolClass.id]
  );

  if (averageCard.kind === 'term') {
    return (
      <TermGeneralAverageView
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

  const periodBadge = `Année ${schoolYear?.label || ''}`.trim();

  return (
    <SubjectGradebookView
      subject={syntheticSubject}
      schoolClass={schoolClass}
      schoolYear={schoolYear}
      school={school}
      term={term || null}
      disableCloudPersistence={true}
      customSheetLabel={averageCard.title}
      customPeriodBadge={periodBadge}
      onBack={onBack}
    />
  );
};
