import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Outlier_manager from '../pages/Outlier_manager';
import Outlier_manager2 from '../pages/Outlier_manager2';

/**
 * Enveloppe les pages Outlier Manager (univarié / multivarié) dans une fenêtre modale,
 * en réutilisant exactement leur logique et leur visuel (mode "embedded").
 *
 * props:
 *  - open: boolean
 *  - onClose: () => void
 *  - variant: 'v1' (univarié) | 'v2' (multivarié)
 *  - bdName: nom de la table de travail (originale)
 *  - originalBdName: (optionnel, pour v2) nom original affiché
 */
function OutlierManagerDialog({ open, onClose, variant = 'v1', bdName, originalBdName }) {
  const isV2 = variant === 'v2';
  const title = isV2 ? 'Outlier Manager: Multivariate' : 'Outlier Manager: Univariate';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      keepMounted={false}
      PaperProps={{
        className: "outlier-dialog",
        sx: {
          height: '92vh',
          maxHeight: '92vh',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          p: 0,
          m: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 1.5,
            background: '#384850',
            color: '#fff',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <IconButton onClick={onClose} sx={{ color: '#fff' }} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2, backgroundColor: '#f3f4f5' }}>
        {open && (
          isV2 ? (
            <Outlier_manager2
              key={`om2-${bdName}`}
              embedded
              bdName={bdName}
              originalBdName={originalBdName || bdName}
              onClose={onClose}
            />
          ) : (
            <Outlier_manager
              key={`om1-${bdName}`}
              embedded
              bdName={bdName}
              onClose={onClose}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

export default OutlierManagerDialog;
