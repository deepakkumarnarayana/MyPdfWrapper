import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
} from '@mui/material';

interface CreateFlashcardModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (question: string, answer: string) => void;
  contextText: string;
  pageNumber: number;
}

export const CreateFlashcardModal: React.FC<CreateFlashcardModalProps> = ({
  open,
  onClose,
  onSave,
  contextText,
  pageNumber,
}) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    // Pre-fill the answer field with the highlighted text when the modal opens
    if (open) {
      setAnswer(contextText);
      // Reset question field
      setQuestion('');
    }
  }, [open, contextText]);

  const handleSave = () => {
    if (question.trim() && answer.trim()) {
      onSave(question, answer);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create a New Flashcard</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="textSecondary">
          Page {pageNumber}
        </Typography>
        <Box sx={{ my: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Context (from PDF):
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
            "{contextText}"
          </Typography>
        </Box>
        <TextField
          autoFocus
          margin="dense"
          id="question"
          label="Question"
          type="text"
          fullWidth
          variant="outlined"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          helperText="What question does this text answer?"
        />
        <TextField
          margin="dense"
          id="answer"
          label="Answer"
          type="text"
          fullWidth
          multiline
          rows={4}
          variant="outlined"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!question.trim() || !answer.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
