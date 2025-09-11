import { connect } from "datocms-plugin-sdk";
import "datocms-react-ui/styles.css";
import { render } from "./utils/render";
import { ZonedDateTimeField } from "./components/ZonedDateTimeField";
import { DebugModal } from "./components/DebugModal";

connect({
  manualFieldExtensions() {
    return [
      {
        id: "zonedDateTime",
        name: "Zoned DateTime",
        type: "editor",
        fieldTypes: ["json"],
        configurable: false,
        helpText:
          "Saves a JSON object with IXDTF and derived fields (zoned_datetime_ixdtf, datetime_iso8601, zone, offset, date, time_24hr, time_12hr, am_pm, timestamp_epoch_seconds)",
      },
    ];
  },

  renderFieldExtension(fieldExtensionId, ctx) {
    if (fieldExtensionId === "zonedDateTime") {
      return render(<ZonedDateTimeField ctx={ctx} />);
    }
  },

  fieldDropdownActions(field) {
    if (field.attributes?.appearance?.field_extension === "zonedDateTime") {
      return [
        {
          id: "showDebug",
          label: "Show JSON value",
          icon: "code",
        },
      ];
    } else {
      return [];
    }
  },

  async executeFieldDropdownAction(actionId, ctx) {
    if (actionId === "showDebug") {
      ctx.openModal({
        id: "debugModal",
        title: `${ctx.fieldPath}`,
        width: "xl",
        parameters: { value: ctx.formValues[ctx.fieldPath] },
      });
    }
  },

  renderModal(modalId, ctx) {
    if (modalId === "debugModal") {
      render(<DebugModal ctx={ctx} />);
    }
  },
});
