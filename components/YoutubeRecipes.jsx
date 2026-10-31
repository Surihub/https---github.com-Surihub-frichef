import React from 'react';
import SavedLinks from './SavedLinks';

export default function YoutubeRecipes({ recipes, onSave, onDelete }) {
  return <SavedLinks items={recipes} type="youtube" onSave={onSave} onDelete={onDelete} />;
}
