import {
  Captions,
  Cloud,
  Disc3,
  FilePlus2,
  Folder,
  FolderPlus,
  Headphones,
  Heart,
  History,
  Library,
  ListMusic,
  Mic2,
  Music2,
  Radio,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AlbumsPage } from '../pages/AlbumsPage';
import { ArtistsPage } from '../pages/ArtistsPage';
import { FoldersPage } from '../pages/FoldersPage';
import { ImportFolderPage } from '../pages/ImportFolderPage';
import { PlaylistsPage } from '../pages/PlaylistsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SongsPage } from '../pages/SongsPage';
import { EmptyState } from '../components/ui/EmptyState';

export type AppRouteId =
  | 'songs'
  | 'albums'
  | 'artists'
  | 'folders'
  | 'remote'
  | 'streaming'
  | 'queue'
  | 'history'
  | 'playlists'
  | 'liked'
  | 'audio-settings'
  | 'lyrics-settings'
  | 'import-folder'
  | 'import-file'
  | 'settings';

export type AppRoute = {
  id: AppRouteId;
  label: string;
  description: string;
  icon: LucideIcon;
  placement: 'main' | 'utility';
  element: JSX.Element;
};

const PlaceholderPage = ({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}): JSX.Element => (
  <div className="page-stack">
    <EmptyState icon={icon} title={title} description={description} meta="This view still uses the shared ECHO Next shell." />
  </div>
);

export const appRoutes: AppRoute[] = [
  {
    id: 'songs',
    label: 'Songs',
    description: 'Local library song list.',
    icon: Music2,
    placement: 'main',
    element: <SongsPage />,
  },
  {
    id: 'albums',
    label: 'Albums',
    description: 'Grouped album wall.',
    icon: Disc3,
    placement: 'main',
    element: <AlbumsPage />,
  },
  {
    id: 'artists',
    label: 'Artists',
    description: 'Browse by artist.',
    icon: Mic2,
    placement: 'main',
    element: <ArtistsPage />,
  },
  {
    id: 'folders',
    label: 'Folders',
    description: 'Local import roots.',
    icon: Folder,
    placement: 'main',
    element: <FoldersPage />,
  },
  {
    id: 'remote',
    label: 'Cloud / Remote',
    description: 'Remote sources.',
    icon: Cloud,
    placement: 'main',
    element: <PlaceholderPage icon={Cloud} title="Cloud / Remote" description="Remote mounting and sync sources stay here." />,
  },
  {
    id: 'streaming',
    label: 'Streaming',
    description: 'Streaming providers.',
    icon: Radio,
    placement: 'main',
    element: <PlaceholderPage icon={Radio} title="Streaming" description="Streaming service hooks will be grouped here." />,
  },
  {
    id: 'queue',
    label: 'Queue',
    description: 'Playback queue.',
    icon: ListMusic,
    placement: 'main',
    element: <PlaceholderPage icon={ListMusic} title="Queue" description="Queue UI stays separate from the song list." />,
  },
  {
    id: 'history',
    label: 'History',
    description: 'Playback history.',
    icon: History,
    placement: 'main',
    element: <PlaceholderPage icon={History} title="History" description="Recent plays and history will appear here." />,
  },
  {
    id: 'playlists',
    label: 'Playlists',
    description: 'User playlists.',
    icon: Library,
    placement: 'main',
    element: <PlaylistsPage />,
  },
  {
    id: 'liked',
    label: 'Liked',
    description: 'Saved tracks.',
    icon: Heart,
    placement: 'utility',
    element: <PlaceholderPage icon={Heart} title="Liked" description="Liked tracks will keep a compact list view." />,
  },
  {
    id: 'audio-settings',
    label: 'Audio Settings',
    description: 'Output and decoder settings.',
    icon: Headphones,
    placement: 'utility',
    element: <PlaceholderPage icon={Headphones} title="Audio Settings" description="Output device, sample rate, and decoder options live here." />,
  },
  {
    id: 'lyrics-settings',
    label: 'Lyrics Settings',
    description: 'Lyrics preferences.',
    icon: Captions,
    placement: 'utility',
    element: <PlaceholderPage icon={Captions} title="Lyrics Settings" description="Lyrics sources and timing settings are stored here." />,
  },
  {
    id: 'import-folder',
    label: 'Import Folder',
    description: 'Choose a local music folder.',
    icon: FolderPlus,
    placement: 'utility',
    element: <ImportFolderPage />,
  },
  {
    id: 'import-file',
    label: 'Import File',
    description: 'Import a single audio file.',
    icon: FilePlus2,
    placement: 'utility',
    element: <PlaceholderPage icon={FilePlus2} title="Import File" description="Single-file import will reuse the same metadata pipeline." />,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Application settings.',
    icon: Settings,
    placement: 'utility',
    element: <SettingsPage />,
  },
];
