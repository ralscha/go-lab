import type { CourseModule } from '../course.model';
import { start } from './start';
import { basics } from './basics';
import { collections } from './collections';
import { modeling } from './modeling';
import { generics } from './generics';
import { stdlib } from './stdlib';
import { concurrency } from './concurrency';
import { testing } from './testing';
import { engineering } from './engineering';
import { capstones } from './capstones';

export const courseModules: CourseModule[] = [
  start,
  basics,
  collections,
  modeling,
  generics,
  stdlib,
  concurrency,
  testing,
  engineering,
  capstones,
];
