import { Item, Structure } from '../types';

export const addItemToInventory = (inventory: Item[], newItem: Item) => {
  const existing = inventory.find(i => i.name === newItem.name);
  if (existing) {
    existing.quantity += newItem.quantity;
  } else {
    inventory.push(newItem);
  }
};

export const findSourceForItems = (itemsNeeded: {itemName: string, quantity: number}[], pawnInventory: Item[], allStructures: Structure[]): { itemName: string, quantity: number, sourceId: string }[] | null => {
  const sources: { itemName: string, quantity: number, sourceId: string }[] = [];
  
  for (const need of itemsNeeded) {
      const inInv = pawnInventory.find(i => i.name === need.itemName)?.quantity || 0;
      let missing = need.quantity - inInv;
      
      if (missing > 0) {
          const source = allStructures.find(s => 
              s.type === 'CHEST' && 
              s.inventory.some(i => i.name === need.itemName && i.quantity > 0)
          );
          
          if (source) {
              sources.push({ itemName: need.itemName, quantity: missing, sourceId: source.id });
          } else {
              return null; 
          }
      }
  }
  return sources;
};