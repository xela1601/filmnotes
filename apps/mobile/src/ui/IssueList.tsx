import type { IssueLevel, ValidationIssue } from "@filmnotes/domain";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "./theme";

export interface IssueListProps {
  issues: ValidationIssue[];
  testID?: string;
}

/** Renders validation issues from T-002, coloured by level and translated by code. */
export function IssueList({ issues, testID }: IssueListProps) {
  const { palette, fontSize } = useTheme();
  const { t } = useTranslation();

  if (issues.length === 0) return null;

  const colorFor = (level: IssueLevel): string =>
    level === "error" ? palette.danger : level === "warning" ? palette.warning : palette.info;

  return (
    <View testID={testID} style={styles.list}>
      {issues.map((issue, index) => (
        <Text
          // Codes can repeat per field (several mismatching filters), and the list is recomputed
          // as a whole on every keystroke, so the index is part of the key on purpose.
          // eslint-disable-next-line @eslint-react/no-array-index-key
          key={`${issue.code}-${issue.field ?? "none"}-${index}`}
          testID={testID === undefined ? undefined : `${testID}-${issue.code}`}
          style={[styles.issue, { color: colorFor(issue.level), fontSize: fontSize.sm }]}
        >
          {t(`validation.${issue.code}`, issue.params)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 4 },
  issue: { fontWeight: "500" },
});
