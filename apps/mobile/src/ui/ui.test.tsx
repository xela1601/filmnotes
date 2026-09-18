import type { ValidationIssue } from "@filmnotes/domain";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";

import { i18n } from "../i18n";
import {
  Button,
  EmptyState,
  IssueList,
  ListItem,
  MultiSelectField,
  NumberField,
  Screen,
  Section,
  SelectField,
  SwitchField,
  TextField,
} from "./index";

describe("ui kit", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de");
  });

  it("renders Screen with a title", () => {
    render(
      <Screen title="Filme" testID="screen">
        <Text>content</Text>
      </Screen>,
    );

    expect(screen.getByTestId("screen")).toBeOnTheScreen();
    expect(screen.getByText("Filme")).toBeOnTheScreen();
    expect(screen.getByText("content")).toBeOnTheScreen();
  });

  it("renders Section", () => {
    render(
      <Section title="Belichtung" testID="section">
        <Text>body</Text>
      </Section>,
    );

    expect(screen.getByTestId("section")).toBeOnTheScreen();
    expect(screen.getByText("BELICHTUNG")).toBeOnTheScreen();
  });

  it("renders TextField and reports changes", () => {
    const onChangeText = jest.fn();
    render(<TextField label="Notizen" value="alt" onChangeText={onChangeText} testID="notes" />);

    expect(screen.getByDisplayValue("alt")).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId("notes"), "neu");
    expect(onChangeText).toHaveBeenCalledWith("neu");
  });

  it("masks a TextField marked as secret", () => {
    render(
      <TextField
        label="Passwort"
        value="s3cret"
        onChangeText={jest.fn()}
        secret
        testID="password"
      />,
    );

    const input = screen.getByTestId("password");
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.autoCapitalize).toBe("none");
  });

  it("renders NumberField and steps the value", () => {
    const onChange = jest.fn();
    render(
      <NumberField label="Bild" value={3} onChange={onChange} step={1} min={1} testID="frameNo" />,
    );

    expect(screen.getByDisplayValue("3")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("frameNo-increment"));
    expect(onChange).toHaveBeenCalledWith(4);
    fireEvent.press(screen.getByTestId("frameNo-decrement"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("lets a decimal be typed, one keystroke at a time", () => {
    // The regression: a controlled `String(value)` turned "1." back into "1" on the spot, so
    // typing an f/1.7 lens into the equipment editor stored 17.
    function Controlled() {
      const [value, setValue] = useState<number | null>(null);
      return <NumberField label="Blende" value={value} onChange={setValue} testID="aperture" />;
    }
    render(<Controlled />);
    const input = screen.getByTestId("aperture");

    fireEvent.changeText(input, "1");
    fireEvent.changeText(input, "1.");
    expect(screen.getByDisplayValue("1.")).toBeOnTheScreen();

    fireEvent.changeText(input, "1.7");
    expect(screen.getByDisplayValue("1.7")).toBeOnTheScreen();
  });

  it("accepts a comma as the decimal separator of a German keyboard", () => {
    const onChange = jest.fn();
    render(<NumberField label="Blende" value={null} onChange={onChange} testID="aperture" />);

    fireEvent.changeText(screen.getByTestId("aperture"), "1,7");

    expect(onChange).toHaveBeenCalledWith(1.7);
    expect(screen.getByDisplayValue("1,7")).toBeOnTheScreen();
  });

  it("takes a value that changed elsewhere", () => {
    const { rerender } = render(
      <NumberField label="Blende" value={5.6} onChange={jest.fn()} testID="aperture" />,
    );
    expect(screen.getByDisplayValue("5.6")).toBeOnTheScreen();

    rerender(<NumberField label="Blende" value={8} onChange={jest.fn()} testID="aperture" />);

    expect(screen.getByDisplayValue("8")).toBeOnTheScreen();
  });

  it("renders SelectField as a segmented control and reports the choice", () => {
    const onChange = jest.fn();
    render(
      <SelectField
        label="Modus"
        value="P"
        options={[
          { value: "P", label: "P" },
          { value: "A", label: "A" },
          { value: "S", label: "S" },
          { value: "M", label: "M" },
        ]}
        onChange={onChange}
        testID="mode"
      />,
    );

    expect(screen.getByTestId("mode-option-A")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("mode-option-A"));
    expect(onChange).toHaveBeenCalledWith("A");
  });

  it("renders SelectField as a modal picker for more than four options", () => {
    const onChange = jest.fn();
    render(
      <SelectField
        label="Verschlusszeit"
        value={null}
        options={["1/60", "1/125", "1/250", "1/500", "1/1000"].map((v) => ({
          value: v,
          label: v,
        }))}
        onChange={onChange}
        nullable
        testID="shutter"
      />,
    );

    fireEvent.press(screen.getByTestId("shutter-open"));
    fireEvent.press(screen.getByTestId("shutter-option-1/250"));
    expect(onChange).toHaveBeenCalledWith("1/250");
  });

  it("renders MultiSelectField and toggles values", () => {
    const onChange = jest.fn();
    render(
      <MultiSelectField
        label="Filter"
        values={["uv"]}
        options={[
          { value: "uv", label: "UV" },
          { value: "pl", label: "PL" },
        ]}
        onChange={onChange}
        testID="filters"
      />,
    );

    fireEvent.press(screen.getByTestId("filters-option-pl"));
    expect(onChange).toHaveBeenCalledWith(["uv", "pl"]);
    fireEvent.press(screen.getByTestId("filters-option-uv"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("renders SwitchField and reports changes", () => {
    const onChange = jest.fn();
    render(
      <SwitchField label="Streulichtblende" value={false} onChange={onChange} testID="hood" />,
    );

    fireEvent(screen.getByTestId("hood"), "valueChange", true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders Button and calls onPress", () => {
    const onPress = jest.fn();
    render(<Button title="Speichern" onPress={onPress} testID="save" />);

    fireEvent.press(screen.getByTestId("save"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress on a disabled Button", () => {
    const onPress = jest.fn();
    render(<Button title="Speichern" onPress={onPress} disabled testID="save" />);

    fireEvent.press(screen.getByTestId("save"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders ListItem with subtitle and handles the press", () => {
    const onPress = jest.fn();
    render(
      <ListItem title="Kodak Gold 200" subtitle="36 Bilder" onPress={onPress} testID="roll" />,
    );

    expect(screen.getByText("36 Bilder")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("roll"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders EmptyState", () => {
    render(<EmptyState title="Keine Filme" hint="Lege einen Film an." testID="empty" />);

    expect(screen.getByText("Keine Filme")).toBeOnTheScreen();
    expect(screen.getByText("Lege einen Film an.")).toBeOnTheScreen();
  });

  describe("IssueList", () => {
    const issues: ValidationIssue[] = [
      {
        level: "warning",
        code: "handheld_shake_risk",
        field: "shutterSpeed",
        params: { limit: "1/60" },
      },
      { level: "error", code: "bulb_only_in_m", field: "shutterSpeed", params: {} },
    ];

    it("renders translated issue texts", () => {
      render(<IssueList issues={issues} testID="issues" />);

      expect(screen.getByTestId("issues-handheld_shake_risk")).toHaveTextContent("1/60", {
        exact: false,
      });
      expect(screen.getByTestId("issues-bulb_only_in_m")).toHaveTextContent(
        i18n.t("validation.bulb_only_in_m"),
      );
    });

    it("renders nothing without issues", () => {
      render(<IssueList issues={[]} testID="issues" />);

      expect(screen.queryByTestId("issues")).toBeNull();
    });
  });
});
