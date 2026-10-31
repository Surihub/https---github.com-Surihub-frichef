import React from 'react';
import SavedLinks from './SavedLinks';

export default function SavedPlaces({ places, onSave, onDelete }) {
  return <SavedLinks items={places} type="place" onSave={onSave} onDelete={onDelete} />;
}
