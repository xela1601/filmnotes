import type { IssueLevel, ValidationIssue } from "@filmnotes/domain";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "./theme";
import { fontWeight, spacing } from "./themes";

export interface IssueListProps {
  issues: ValidationIssue[];
  testID?: string;
}

/**
 * The icon per level. Colour alone does not carry the difference: in the black-and-white and
 * the high-contrast themes a warning and an error are nearly the same hue (T-026).
 */
const ICON: Record<IssueLevel, keyof typeof Ionicons.glyphMap> = {
  error: "alert-circle",
  warning: "warning",
  info: "information-circle",
};

/** Renders validation issues from T-002, marked and coloured by level and translated by code. */
export function IssueList({ issues, testID }: IssueListProps) {
  const { palette, fontSize } = useTheme();
  const { t } = useTranslation();

  if (issues.length === 0) return null;

  const colorFor = (level: IssueLevel): string =>
    level === "error" ? palette.danger : level === "warning" ? palette.warning : palette.info;

  return (
    <View testID={testID} style={styles.list}>
      {issues.map((issue, index) => {
        const id = testID === undefined ? undefined : `${testID}-${issue.code}`;
        return (
          <View
            // Codes can repeat per field (several mismatching filters), and the list is
            // recomputed as a whole on every keystroke, so the index is part of the key on purpose.
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={`${issue.code}-${issue.field ?? "none"}-${index}`}
            style={styles.row}
          >
            <Ionicons
              testID={id === undefined ? undefined : `${id}-icon`}
              name={ICON[issue.level]}
              size={18}
              color={colorFor(issue.level)}
            />
            <Text
              testID={id}
              style={[styles.issue, { color: colorFor(issue.level), fontSize: fontSize.sm }]}
            >
              {t(`validation.${issue.code}`, issue.params)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  issue: { flex: 1, fontWeight: fontWeight.medium },
});
