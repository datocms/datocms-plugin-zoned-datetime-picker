import { connect } from "datocms-plugin-sdk";
import "datocms-react-ui/styles.css";
import { render } from "./utils/render";
import { ZonedDateTimeField } from "./components/ZonedDateTimeField";

connect({
  // Expose our manual field extension for text fields (IXDTF)
  manualFieldExtensions() {
    return [
      {
        id: "zonedDateTime",
        name: "Zoned DateTime",
        type: "editor",
        fieldTypes: ["string"],
        configurable: false,
        helpText:
          "Saves as IXDTF (RFC 9557), e.g. 2025-09-08T15:30:00+02:00[Europe/Rome]",
      },
    ];
  },

  // Render it
  renderFieldExtension(fieldExtensionId, ctx) {
    if (fieldExtensionId === "zonedDateTime") {
      return render(<ZonedDateTimeField ctx={ctx} />);
    }
  },
});
