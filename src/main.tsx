import { connect } from "datocms-plugin-sdk";
import "datocms-react-ui/styles.css";
import { render } from "./utils/render";
import { ZonedDateTimeField } from "./components/ZonedDateTimeField";

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
});
