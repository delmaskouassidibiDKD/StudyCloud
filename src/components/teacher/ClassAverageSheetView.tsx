import React, { useMemo } from 'react';
import { SubjectGradebookView } from './SubjectGradebookView';
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
  onBack: () => void;
}

/**
 * Vue dédiée au tableau de Moyenne Générale d'une classe (annuelle ou trimestrielle).
 * Reprend exactement l'interface du tableur des matières, volontairement NON connectée
 * à la base de données pour le moment afin de pouvoir l'adapter sur mesure dans la prochaine étape.
 */
export const ClassAverageSheetView: React.FC<ClassAverageSheetViewProps> = ({
  averageCard,
  schoolClass,
  schoolYear,
  school,
  term,
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

  const periodBadge =
    averageCard.kind === 'annual'
      ? `Année ${schoolYear?.label || ''}`.trim()
      : `${term?.name || averageCard.title.replace(/^Moyenne générale · /i, '')}${
          term?.coefficient !== undefined && term?.coefficient !== null ? ` · Coeff ${term.coefficient}` : ''
        }`;

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
