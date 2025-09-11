import { type RenderModalCtx } from "datocms-plugin-sdk";
import { Canvas } from "datocms-react-ui";

export const DebugModal = ({ ctx }: { ctx: RenderModalCtx }) => {
  const { parameters } = ctx;
  const { value } = parameters as { value: string };
  return (
    <Canvas ctx={ctx}>
      <pre>
        <code>{value}</code>
      </pre>
    </Canvas>
  );
};
