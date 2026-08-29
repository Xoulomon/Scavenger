import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { WasteTypeStep } from './steps/WasteTypeStep';
import { WasteDetailsStep } from './steps/WasteDetailsStep';
import { LocationStep } from './steps/LocationStep';
import { ReviewStep } from './steps/ReviewStep';
import { ProgressIndicator } from './ProgressIndicator';
import { WasteType } from '@/api/types';
import { wasteSubmissionSchema } from '@/lib/validation/wasteSubmission';

interface WasteSubmissionFormData {
  wasteType: WasteType | '';
  weight: string;
  latitude: string;
  longitude: string;
  notes: string;
}

const STEPS = [
  { id: 1, title: 'Waste Type' },
  { id: 2, title: 'Details' },
  { id: 3, title: 'Location' },
  { id: 4, title: 'Review' },
];

export function WasteSubmissionWizard({ onComplete, onCancel }: { onComplete: (data: WasteSubmissionFormData) => void; onCancel: () => void }) {
  const [currentStep, setCurrentStep] = useState(1);
  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm<WasteSubmissionFormData>({
    resolver: zodResolver(wasteSubmissionSchema('grams')),
    defaultValues: {
      wasteType: WasteType.Paper,
      weight: '',
      latitude: '',
      longitude: '',
      notes: '',
    },
  });

  const formData = watch();

  const saveDraft = () => {
    localStorage.setItem('waste_submission_draft', JSON.stringify({ ...formData, step: currentStep }));
  };

  const _loadDraft = () => {
    const draft = localStorage.getItem('waste_submission_draft');
    if (draft) {
      const parsed = JSON.parse(draft);
      Object.keys(parsed).forEach((key) => {
        if (key !== 'step') {
          setValue(key as keyof WasteSubmissionFormData, parsed[key]);
        }
      });
      setCurrentStep(parsed.step || 1);
    }
  };

  const validateStep = async () => {
    let fieldsToValidate: (keyof WasteSubmissionFormData)[] = [];
    if (currentStep === 1) fieldsToValidate = ['wasteType'];
    else if (currentStep === 2) fieldsToValidate = ['weight'];
    else if (currentStep === 3) fieldsToValidate = ['latitude', 'longitude'];
    
    const isValid = await trigger(fieldsToValidate);
    return isValid;
  };

  const nextStep = async () => {
    const isValid = await validateStep();
    if (isValid && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      saveDraft();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: WasteSubmissionFormData) => {
    localStorage.removeItem('waste_submission_draft');
    onComplete(data);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <WasteTypeStep register={register} formData={formData} setValue={setValue} />;
      case 2:
        return <WasteDetailsStep register={register} errors={errors} />;
      case 3:
        return <LocationStep register={register} errors={errors} formData={formData} />;
      case 4:
        return <ReviewStep formData={formData} />;
      default:
        return null;
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <ProgressIndicator steps={STEPS} currentStep={currentStep} />
      
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
        {renderStep()}

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
                Submit Waste
              </Button>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}