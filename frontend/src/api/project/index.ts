import { createProject } from './create';
import { getProjects } from './getAll';
import { getProject } from './getById';
import { deleteProject } from './delete';
import { updateProjectName } from './updateName';
import { saveProjectTimeline } from './saveTimeline';
import { getPresets } from './getPresets';
import { getEditingRegistry } from './getEditingRegistry';

export const projectApi = {
  create: createProject,
  getAll: getProjects,
  getById: getProject,
  delete: deleteProject,
  updateName: updateProjectName,
  saveTimeline: saveProjectTimeline,
  getPresets,
  getEditingRegistry,
};
