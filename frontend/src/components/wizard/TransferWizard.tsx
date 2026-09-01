import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { WasteSelectionStep } from './steps/WasteSelectionStep';
import { RecipientSelectionStep } from './steps/RecipientSelectionStep';
import { TransferDetailsStep } from './steps/TransferDetailsStep';
import { ReviewConfirmStep } from './steps/ReviewConfirmStep';
import { ProgressIndicator } from './ProgressIndicator';

interface TransferFormData {
  wasteIds: string[];
  recipientAddress: string;
  location: string;
  notes: string;
}

const STEPS = [
  { id: 1, title: 'Select Waste', component: WasteSelectionStep },
  { id: 2, title: 'Select Recipient', component: RecipientSelectionStep },
  { id: 3, title: 'Transfer Details', component: TransferDetailsStep },
  { id: 4, title: 'Review & Confirm', component: ReviewConfirmStep },
];

export function TransferWizard({ onComplete, onCancel }: { onComplete: (data: TransferFormData) => void; onCancel: () => void }) {
  const [currentStep, setCurrentStep] = useState(1);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<TransferFormData>({
    defaultValues: {
      wasteIds: [],
      recipientAddress: '',
      location: '',
      notes: '',
    },
  });

  const formData = watch();

  const saveDraft = () => {
    localStorage.setItem('transfer_draft', JSON.stringify({ ...formData, step: currentStep }));
  };

  const loadDraft = () => {
    const draft = localStorage.getItem('transfer_draft');
    if (draft) {
      const parsed = JSON.parse(draft);
      Object.keys(parsed).forEach((key) => {
        if (key !== 'step') {
          setValue(key as keyof TransferFormData, parsed[key]);
        }
      });
      setCurrentStep(parsed.step || 1);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      saveDraft();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: TransferFormData) => {
    localStorage.removeItem('transfer_draft');
    onComplete(data);
  };

  const CurrentStepComponent = STEPS[currentStep - 1].component;

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <ProgressIndicator steps={STEPS} currentStep={currentStep} />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
        <CurrentStepComponent
          register={register}
          errors={errors}
          formData={formData}
          setValue={setValue}
        />

        <div className="flex justify-between mt-6">
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button type="button" onClick={prevStep} variant="outline">
                Back
              </Button>
            )}
            <Button type="button" onClick={onCancel} variant="outline">
              Cancel
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={saveDraft} variant="outline">
              Save Draft
            </Button>
            {currentStep < STEPS.length ? (
              <Button type="button" onClick={nextStep}>
                Next
              </Button>
            ) : (
              <Button type="submit">
                Confirm Transfer
              </Button>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
