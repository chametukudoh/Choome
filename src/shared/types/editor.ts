export interface TimelineClip {
  id: string;
  sourcePath: string;
  sourceStart: number;
  sourceEnd: number;
}

export interface TimelineProject {
  id: string;
  name: string;
  clips: TimelineClip[];
  createdAt: string;
}
