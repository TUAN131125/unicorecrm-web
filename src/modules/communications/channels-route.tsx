import { ChannelSettingsView } from "./presentation/components/ChannelSettingsView";
import { useChannelSettings } from "./presentation/hooks/useChannelSettings";
export default function ChannelSettingsPage() { return <ChannelSettingsView {...useChannelSettings()} />; }
