/**
 * ─────────────────────────────────────────────────────────────────
 * SelectDeviceView.tsx  —  Live audio device picker
 * ─────────────────────────────────────────────────────────────────
 *
 * This screen is pushed (opened) from the Identify Song ready screen
 * when the user chooses "Change Audio Input Device" from the Actions
 * panel (⌘K).
 *
 * What it does:
 *   1. On open, runs a quick command to ask the OS what audio input
 *      devices are available right now.
 *   2. Shows them in a dropdown — like a speaker selector on a TV.
 *   3. When the user picks one and presses Save, we store the choice
 *      in Raycast's LocalStorage.
 *   4. From that point on, the recorder reads the stored device and
 *      uses it instead of auto-detecting.
 *
 * Works on Windows, macOS, and Linux — detection logic differs by OS
 * but the UI is the same for all three.
 * ─────────────────────────────────────────────────────────────────
 */

import React from "react";
import {
  Form,          // The form component — renders labelled inputs
  ActionPanel,   // The container for button-like actions
  Action,        // A single action button
  LocalStorage,  // Key-value storage persisted by Raycast
  showToast,     // Shows a brief notification (success / error)
  Toast,         // The toast notification type definitions
  useNavigation, // Hook to navigate between screens (go back, push new screen)
  Icon,          // Raycast's built-in icon set
} from "@raycast/api";
import { useState, useEffect } from "react";
import { exec }     from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ─── Shared constant ──────────────────────────────────────────────────────────
//
// SELECTED_DEVICE_KEY is the name of the slot in LocalStorage where we save
// the user's device choice.  It's exported so recorder.ts can read it using
// the same key without us having to duplicate the string in two places.
// Think of it like giving the same locker number to two people who share the locker.
//
export const SELECTED_DEVICE_KEY = "selectedAudioDevice";

// The special value used in the dropdown to mean "don't override — just auto-detect"
const AUTO_DETECT_ID = "__auto__";

// ─── Type definitions ─────────────────────────────────────────────────────────

interface AudioDevice {
  id:   string; // The identifier passed to ffmpeg (device name on Windows, index on macOS)
  name: string; // The human-readable label shown in the dropdown
}

interface StoredDevice {
  id:       string; // Same as AudioDevice.id
  name:     string; // Human-readable name — shown on the ready screen
  platform: string; // "win32" / "darwin" / "linux" — so we don't use Windows devices on Mac
}

// ─── Device detection functions ───────────────────────────────────────────────
//
// Each function runs a system command and parses the output to get a list
// of audio input devices.  They all return the same type (AudioDevice[])
// so the rest of the code doesn't need to know which OS it's on.

/** Windows: query ffmpeg's DirectShow device list */
async function detectWindowsDevices(): Promise<AudioDevice[]> {
  try {
    // ffmpeg -list_devices always exits with an error code, so we catch that error
    // and still read its output (which contains the device list we need)
    const result = await execAsync("ffmpeg -list_devices true -f dshow -i dummy", {
      shell:     "cmd.exe",
      maxBuffer: 10 * 1024 * 1024,
    }).catch((err) => err);

    const output = String(result.stdout || "") + String(result.stderr || "");
    const devices: AudioDevice[] = [];

    // Parse lines like: "Microphone (Realtek Audio)" (audio)
    // The regex finds quoted names followed by "(audio)"
    const matches = output.match(/"([^"]+)"\s*\(audio\)/g);
    if (matches) {
      for (const match of matches) {
        const name = match.match(/"([^"]+)"/)?.[1];
        if (name) devices.push({ id: name, name }); // On Windows, name = id
      }
    }
    return devices;
  } catch {
    return []; // Return an empty list rather than crashing if detection fails
  }
}

/** macOS: query ffmpeg's AVFoundation device list */
async function detectMacOSDevices(): Promise<AudioDevice[]> {
  try {
    const result = await execAsync('ffmpeg -f avfoundation -list_devices true -i ""', {
      timeout: 8000, // Give up after 8 seconds if the command hangs
    }).catch((err) => err);

    const output = String(result.stdout || "") + String(result.stderr || "");
    const devices: AudioDevice[] = [];
    const lines = output.split("\n");
    let inAudioSection = false;

    // The output has sections: first video devices, then audio devices
    // We only want to parse lines after "AVFoundation audio devices"
    for (const line of lines) {
      if (line.includes("AVFoundation audio devices")) { inAudioSection = true; continue; }
      if (inAudioSection && line.includes("AVFoundation video devices")) break; // Stop at the next section
      if (inAudioSection) {
        // Lines look like: [0] Built-in Microphone
        const match = line.match(/\[(\d+)\]\s+(.+?)\s*$/);
        if (match) devices.push({ id: match[1], name: match[2].trim() });
      }
    }
    return devices;
  } catch {
    return [];
  }
}

/** Linux: query PulseAudio for available source devices */
async function detectLinuxDevices(): Promise<AudioDevice[]> {
  try {
    const { stdout } = await execAsync("pactl list sources short", { timeout: 5000 });
    // Output looks like: "0  alsa_input.pci-0000_00_1f.3.analog-stereo  ..."
    return stdout
      .split("\n")
      .flatMap((line) => {
        const parts = line.trim().split(/\s+/);
        // Skip ".monitor" devices — those are loopback captures of speakers, not real microphones
        if (parts.length >= 2 && !parts[1].includes(".monitor")) {
          return [{ id: parts[1], name: parts[1] }];
        }
        return [];
      });
  } catch {
    return [];
  }
}

/** Picks the right detection function for the current OS */
async function detectDevices(): Promise<AudioDevice[]> {
  if (process.platform === "win32")  return detectWindowsDevices();
  if (process.platform === "darwin") return detectMacOSDevices();
  return detectLinuxDevices();
}

// ─── The React component ──────────────────────────────────────────────────────
//
// A React "component" is a function that returns UI.
// Every time the state changes (e.g. devices finish loading),
// React re-runs this function and updates what's displayed.

export default function SelectDeviceView() {
  const { pop } = useNavigation(); // pop() = go back to the previous screen

  // useState creates a variable that, when changed, causes the UI to re-render
  const [devices,   setDevices]   = useState<AudioDevice[]>([]);   // List of found devices
  const [isLoading, setIsLoading] = useState(true);                 // True while detecting
  const [currentId, setCurrentId] = useState<string>(AUTO_DETECT_ID); // Which item is selected

  // useEffect runs a side-effect once when the component first appears on screen.
  // The empty [] at the end means "only run once, not on every re-render".
  useEffect(() => {
    async function init() {
      try {
        // ── Load the previously saved device (if any) ─────────────────────
        const stored = await LocalStorage.getItem<string>(SELECTED_DEVICE_KEY);
        if (stored) {
          const parsed: StoredDevice = JSON.parse(stored);
          // Only restore the selection if it's for the same OS we're currently on
          if (parsed.platform === process.platform) setCurrentId(parsed.id);
        }

        // ── Detect devices ────────────────────────────────────────────────
        const found = await detectDevices();
        setDevices(found); // Update the dropdown list
      } catch (err) {
        await showToast({ style: Toast.Style.Failure, title: "Failed to detect devices", message: String(err) });
      } finally {
        setIsLoading(false); // Hide the loading spinner regardless of success/failure
      }
    }
    init();
  }, []); // Empty dependency array = run once on mount

  /**
   * handleSubmit
   *
   * Called when the user clicks "Save Device".
   * 'values' is an object containing the current form field values.
   * Because our only field has id="device", we get values.device.
   */
  async function handleSubmit(values: { device: string }) {
    try {
      if (values.device === AUTO_DETECT_ID) {
        // User chose "Auto-detect" → clear any saved device
        await LocalStorage.removeItem(SELECTED_DEVICE_KEY);
        await showToast({ style: Toast.Style.Success, title: "Reset to auto-detect" });
      } else {
        // Find the selected device object so we can save its human-readable name too
        const selected = devices.find((d) => d.id === values.device);
        const entry: StoredDevice = {
          id:       values.device,
          name:     selected?.name ?? values.device, // Fall back to id if name is missing
          platform: process.platform, // "win32" / "darwin" / "linux"
        };
        // Save to LocalStorage — JSON.stringify turns the object into a text string
        await LocalStorage.setItem(SELECTED_DEVICE_KEY, JSON.stringify(entry));
        await showToast({
          style:   Toast.Style.Success,
          title:   "Audio device saved",
          message: selected?.name ?? values.device,
        });
      }
      pop(); // Navigate back to the ready screen
    } catch (err) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to save", message: String(err) });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  //
  // <Form> renders a Raycast form screen.
  // isLoading={isLoading} shows a spinner while devices are being detected.
  //
  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          {/* Action.SubmitForm calls handleSubmit with the current form values */}
          <Action.SubmitForm title="Save Device" icon={Icon.CheckCircle} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      {/* Form.Dropdown renders a labelled dropdown / select box */}
      <Form.Dropdown
        id="device"                  // Must match the key in handleSubmit's 'values'
        title="Audio Input Device"
        value={currentId}            // The currently selected value
        onChange={setCurrentId}      // Called whenever the user picks a different option
        info="The microphone or audio interface SongSnap will record from."
      >
        {/* Always show "Auto-detect" at the top */}
        <Form.Dropdown.Item value={AUTO_DETECT_ID} title="🔍 Auto-detect (system default)" />

        {/* Only show detected devices if we found at least one */}
        {devices.length > 0 && (
          <Form.Dropdown.Section title="Detected Devices">
            {/* .map() iterates over the array and turns each item into a UI element */}
            {devices.map((d) => (
              <Form.Dropdown.Item key={d.id} value={d.id} title={d.name} />
            ))}
          </Form.Dropdown.Section>
        )}
      </Form.Dropdown>

      {/* Show a warning if detection finished but found nothing */}
      {!isLoading && devices.length === 0 && (
        <Form.Description
          title="⚠️ No devices detected"
          text="Make sure ffmpeg is installed and in your PATH. Auto-detect will be used as a fallback."
        />
      )}
    </Form>
  );
}
