import {Badge, Box, Checkbox, Group, Text} from '@optiaxiom/react';
import {IconCircleCheck, IconCircleExclamation, IconCircleMinus, IconLanguage} from '@optiaxiom/icons';
import type {ChildItem} from '@shared/protocol';
import {badgeFor, isPublishable, timeAgo} from './format';

interface Props {
  child: ChildItem;
  selected: boolean;
  disabled: boolean;
  onToggle: (key: string, checked: boolean) => void;
}

function subtitle(child: ChildItem): string {
  if (child.error) return child.error;
  const parts = [child.contentType, timeAgo(child.lastModified) && `edited ${timeAgo(child.lastModified)}`];
  return parts.filter(Boolean).join(' · ');
}

function StatusIcon({child}: {child: ChildItem}) {
  const size = {width: 18, height: 18};
  if (child.state === 'published') {
    return <Box color="fg.success" display="flex"><IconCircleCheck style={size} /></Box>;
  }
  if (child.state === 'error') {
    return <Box color="fg.error" display="flex"><IconCircleExclamation style={size} /></Box>;
  }
  if (child.otherLocales.length > 0) {
    return <Box color="fg.secondary" display="flex"><IconLanguage style={size} /></Box>;
  }
  return <Box color="fg.secondary" display="flex"><IconCircleMinus style={size} /></Box>;
}

/** One child item. Drafts are selectable; everything else shows a status icon instead. */
export function ChildRow({child, selected, disabled, onToggle}: Props) {
  const badge = badgeFor(child);
  const publishable = isPublishable(child);
  const sub = subtitle(child);

  return (
    <Box
      bg={selected ? 'bg.accent.subtle' : 'bg.default'}
      border="1"
      borderColor={selected ? 'border.accent' : 'border.default'}
      px="10"
      py="8"
      rounded="md"
      transition="colors"
    >
      <Group alignItems="start" gap="8" justifyContent="space-between">
        <Box flex="1" style={{minWidth: 0, overflowWrap: 'anywhere'}}>
          {publishable ? (
            <Checkbox
              checked={selected}
              description={sub || undefined}
              disabled={disabled}
              onCheckedChange={(checked) => onToggle(child.key, checked)}
            >
              <Text asChild fontWeight="500"><span>{child.displayName}</span></Text>
            </Checkbox>
          ) : (
            <Group alignItems="start" gap="8">
              <Box pt="2"><StatusIcon child={child} /></Box>
              <Group flexDirection="column" gap="2" style={{minWidth: 0}}>
                <Text color="fg.default" fontSize="md">{child.displayName}</Text>
                {sub && (
                  <Text color={child.error ? 'fg.error' : 'fg.secondary'} fontSize="sm">
                    {sub}
                  </Text>
                )}
              </Group>
            </Group>
          )}
        </Box>
        <Box style={{flexShrink: 0}}>
          <Badge intent={badge.intent} variant="subtle">{badge.label}</Badge>
        </Box>
      </Group>
    </Box>
  );
}
